# Deploy DuzAPI na VPS — Passo a Passo

ssh root@185.173.110.162
+W+;bws8GWqTm8J'UHy4

## Pré-requisitos na VPS

- Ubuntu 22.04+ ou Debian 12+
- Mínimo: 4GB RAM, 2 vCPUs, 40GB SSD
- Docker + Docker Compose instalados
- Git instalado
- Domínio apontando para o IP da VPS (opcional, mas recomendado para HTTPS)

---

## 1. Instalar Docker (se ainda não tiver)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Instalar Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verificar instalação
docker --version
docker compose version

# Sair e entrar novamente para aplicar grupo docker
exit
```

---

## 2. Clonar o Repositório

```bash
cd /opt
sudo mkdir -p duzapi && sudo chown $USER:$USER duzapi
git clone https://github.com/Herbert22/Duzapi.git duzapi
cd duzapi
```

---

## 3. Gerar Credenciais e Criar .env

```bash
cd whatsapp_automation

# Copiar template
cp .env.example .env

# Gerar senhas seguras automaticamente
SECRET_KEY=$(openssl rand -hex 32)
BRIDGE_AUTH_TOKEN=$(openssl rand -hex 24)
WEBHOOK_SECRET=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 24)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MONGO_PASSWORD=$(openssl rand -hex 24)

# Gerar Fernet key (precisa de python3)
ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || pip3 install cryptography && python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Aplicar no .env
sed -i "s|CHANGE_ME_min_32_chars|$SECRET_KEY|" .env
sed -i "s|CHANGE_ME_bridge_token|$BRIDGE_AUTH_TOKEN|" .env
sed -i "s|CHANGE_ME_webhook_secret|$WEBHOOK_SECRET|" .env
sed -i "s|CHANGE_ME_fernet_key|$ENCRYPTION_KEY|" .env
sed -i "s|CHANGE_ME_redis_password|$REDIS_PASSWORD|" .env
sed -i "s|CHANGE_ME_postgres_password|$POSTGRES_PASSWORD|" .env
sed -i "s|CHANGE_ME_mongo_password|$MONGO_PASSWORD|" .env

echo "Credenciais geradas! Edite o .env para adicionar API keys:"
echo "  nano .env"
```

### Variáveis que você PRECISA editar manualmente:

```bash
nano .env
```

Preencher:
- `GOOGLE_API_KEY=` → sua chave Gemini API
- `NEXTAUTH_URL=` → URL pública (ex: `https://seudominio.com` ou `http://IP_DA_VPS`)
- `CORS_ORIGINS_STR=` → mesma URL pública
- `ASAAS_API_KEY=` → se usar pagamentos (opcional)
- `ASAAS_WEBHOOK_TOKEN=` → se usar pagamentos (opcional)

---

## 4. Subir o Sistema

```bash
# Dentro de /opt/duzapi/whatsapp_automation
docker compose up -d --build
```

Primeira execução demora ~5-10 minutos para build das imagens. Acompanhe:

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f backend
docker compose logs -f celery_worker
docker compose logs -f whatsapp_bridge
docker compose logs -f admin_panel
```

### Verificar se tudo está healthy:
```bash
docker compose ps
```

Todos devem estar `Up` e `(healthy)`.

---

## 5. Criar Primeiro Tenant (Admin)

Acesse o painel admin do backend:

```bash
# Via terminal (se não tiver nginx/domínio configurado):
curl http://localhost:8000/admin/
```

Ou acesse pelo navegador: `http://IP_DA_VPS/admin/`

No painel admin:
1. Crie um **Tenant** (nome, telefone)
2. Crie um **Bot Config** (persona, system prompt, API key do Gemini/OpenAI)

---

## 6. Acessar o Admin Panel (Next.js)

O painel Next.js fica acessível em `http://IP_DA_VPS/` (via nginx).

Se for primeiro acesso, crie uma conta na tela de login.

---

## 7. Conectar WhatsApp

1. Acesse a página **WhatsApp** no admin panel
2. Clique em **Iniciar Sessão** (crie um nome, ex: `session-principal`)
3. Escaneie o QR Code com o WhatsApp no celular
4. Aguarde conectar (status muda para "Conectado")

---

## 8. Configurar HTTPS com Let's Encrypt (Recomendado)

```bash
# Instalar certbot
sudo apt install -y certbot

# Parar nginx temporariamente
docker compose stop nginx

# Gerar certificado
sudo certbot certonly --standalone -d seudominio.com

# O certificado fica em /etc/letsencrypt/live/seudominio.com/
```

Edite `nginx/conf.d/duzapi.conf` (ou crie) para HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name seudominio.com;

    ssl_certificate /etc/letsencrypt/live/seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com/privkey.pem;

    # ... (copie as locations do nginx.conf)
}

server {
    listen 80;
    server_name seudominio.com;
    return 301 https://$host$request_uri;
}
```

Depois reinicie:
```bash
docker compose restart nginx
```

### Renovação automática do certificado:
```bash
# Adicionar ao crontab
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker restart wa_nginx") | crontab -
```

---

## 9. Comandos Úteis

### Reiniciar tudo:
```bash
docker compose restart
```

### Atualizar código (pull + rebuild):
```bash
cd /opt/duzapi
git pull origin hework
cd whatsapp_automation
docker compose up -d --build
```

### Ver logs de erro:
```bash
docker compose logs --tail 100 celery_worker
docker compose logs --tail 100 backend
docker compose logs --tail 100 whatsapp_bridge
```

### Backup manual:
```bash
docker exec wa_postgres pg_dump -U whatsapp whatsapp_automation | gzip > backup_pg_$(date +%Y%m%d).sql.gz
docker exec wa_mongodb mongodump --username whatsapp --password "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > backup_mongo_$(date +%Y%m%d).gz
```

### Restaurar backup:
```bash
gunzip -c backup_pg_YYYYMMDD.sql.gz | docker exec -i wa_postgres psql -U whatsapp whatsapp_automation
docker exec -i wa_mongodb mongorestore --username whatsapp --password "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip < backup_mongo_YYYYMMDD.gz
```

### Parar tudo:
```bash
docker compose down
```

### Parar e remover dados (CUIDADO):
```bash
docker compose down -v  # Remove volumes (perde dados!)
```

---

## 10. Monitoramento

### Verificar saúde:
```bash
curl http://localhost:8000/health
```

### Verificar uso de recursos:
```bash
docker stats --no-stream
```

### Verificar espaço em disco:
```bash
df -h
docker system df
```

### Limpar imagens antigas:
```bash
docker image prune -f
```

---

## Troubleshooting

### Container não inicia:
```bash
docker compose logs <servico>
# Ex: docker compose logs backend
```

### Sessão WhatsApp não conecta:
```bash
docker compose logs whatsapp_bridge
# Se travar, reinicie:
docker compose restart whatsapp_bridge
```

### Admin panel não carrega:
```bash
docker compose logs admin_panel
# Verificar se build passou:
docker compose build admin_panel
```

### Erro de memória:
```bash
# Verificar uso
free -h
docker stats --no-stream
# Reduzir concurrency do Celery no docker-compose.yml:
# --concurrency=2 (em vez de 4)
```

### Banco corrompido após crash:
```bash
docker compose down
docker compose up -d postgres mongodb redis
# Aguardar healthy, depois subir o resto
docker compose up -d
```
