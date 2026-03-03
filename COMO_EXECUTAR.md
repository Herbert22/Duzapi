# Como Executar o DuzAPI Localmente

Este guia descreve como subir todo o ambiente de desenvolvimento manualmente.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Verificar |
|-----------|---------------|-----------|
| Docker Desktop | 24+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python | 3.11+ | `python --version` |

---

## 1. Configurar Variáveis de Ambiente

### Backend (obrigatório antes de tudo)

```bash
cp whatsapp_automation/.env.example whatsapp_automation/.env
```

Edite `whatsapp_automation/.env` e preencha as senhas. Para gerar os valores de segurança:

```bash
# SECRET_KEY (64 hex)
python -c "import secrets; print(secrets.token_hex(32))"

# BRIDGE_AUTH_TOKEN
python -c "import secrets; print(secrets.token_hex(24))"

# WEBHOOK_SECRET (64 hex)
python -c "import secrets; print(secrets.token_hex(32))"

# ENCRYPTION_KEY (Fernet)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Senhas de banco (hex aleatório)
python -c "import secrets; print(secrets.token_hex(16))"
```

### Admin Panel (Next.js)

O arquivo `whatsapp_admin_panel/nextjs_space/.env` já deve existir com:

```env
DATABASE_URL='postgresql://whatsapp:SENHA_POSTGRES@localhost:5433/whatsapp_admin'
NEXTAUTH_SECRET=<string aleatória longa>
NEXTAUTH_URL=http://localhost:3001
ENCRYPTION_KEY=<mesma chave do backend ou uma nova>
ASAAS_API_KEY=<chave da API Asaas>
```

> **Nota:** O banco do Admin Panel (`whatsapp_admin`) é **separado** do banco do backend (`whatsapp_automation`).

---

## 2. Subir Infraestrutura (Bancos de Dados)

```bash
cd whatsapp_automation

# Subir PostgreSQL, MongoDB e Redis
docker compose up -d postgres mongodb redis

# Aguardar ficar healthy (30-60 segundos)
docker compose ps
```

Resultado esperado:
```
NAME         STATUS
wa_mongodb   Up X minutes (healthy)
wa_postgres  Up X minutes (healthy)
wa_redis     Up X minutes (healthy)
```

> **Conflito de porta:** Se a porta 5432 já estiver em uso, altere no `docker-compose.yml`:
> ```yaml
> ports:
>   - "5433:5432"   # usa 5433 no host
> ```
> E ajuste o `DATABASE_URL` do Next.js para usar `:5433`.

---

## 3. Criar Banco do Admin Panel

Se for a primeira vez, crie o banco separado para o Next.js:

```bash
# Conectar no postgres e criar o banco
docker exec wa_postgres psql -U whatsapp -d whatsapp_automation \
  -c "CREATE DATABASE whatsapp_admin;"
```

---

## 4. Build e Start — Backend Python

```bash
cd whatsapp_automation

# Build (primeira vez ou após mudar requirements.txt)
docker compose build backend celery_worker celery_beat

# Subir backend + workers
docker compose up -d backend celery_worker celery_beat
```

Verificar logs:
```bash
docker compose logs -f backend
# Deve aparecer: "API ready at /api/v1" e "Application startup complete"

docker compose logs -f celery_worker
# Deve aparecer: "celery@... ready."
```

---

## 5. Build e Start — WhatsApp Bridge (Node.js)

```bash
cd whatsapp_automation

# Build (primeira vez ou após mudar package.json)
docker compose build whatsapp_bridge

# Subir bridge
docker compose up -d whatsapp_bridge
```

Verificar:
```bash
docker compose logs -f whatsapp_bridge
# Deve aparecer: "WhatsApp Bridge server started"

# Health check
curl http://localhost:3000/api/health
```

---

## 6. Admin Panel — Next.js

```bash
cd whatsapp_admin_panel/nextjs_space

# Instalar dependências (primeira vez)
npm install --force

# Gerar Prisma Client
npx prisma generate

# Rodar migrations (primeira vez ou após mudar schema.prisma)
npx prisma migrate dev --name "nome_da_migration"

# Subir servidor de desenvolvimento
npm run dev -- --port 3001
```

O painel estará disponível em: **http://localhost:3001**

---

## 7. Criar Usuário Admin (Primeiro Acesso)

Para fazer login no painel, crie um usuário no banco:

```bash
# Gerar hash bcrypt para a senha (ex: Admin@1234)
cd whatsapp_admin_panel/nextjs_space
node -e "const b = require('bcryptjs'); console.log(b.hashSync('Admin@1234', 12));"

# Copie o hash gerado e insira no banco
docker exec wa_postgres psql -U whatsapp -d whatsapp_admin -c "
INSERT INTO \"User\" (id, name, email, password, role, \"emailVerified\", \"createdAt\", \"updatedAt\", \"maxTenants\", \"maxMessagesPerMonth\")
VALUES (
  'admin-001',
  'Admin',
  'admin@seudominio.com',
  'COLE_O_HASH_AQUI',
  'admin',
  NOW(), NOW(), NOW(),
  10, 100000
);"
```

---

## 8. Verificar Todos os Serviços

```bash
# Status dos containers Docker
cd whatsapp_automation && docker compose ps

# Health checks
curl http://localhost:8000/health    # Backend API
curl http://localhost:3000/api/health   # WhatsApp Bridge
curl -o /dev/null -w "%{http_code}" http://localhost:3001/login  # Admin Panel (deve retornar 200)

# API Docs (Swagger)
# http://localhost:8000/docs

# Interface Admin Jinja2
# http://localhost:8000/admin
```

---

## 9. Parar Tudo

```bash
# Parar Docker
cd whatsapp_automation && docker compose down

# Parar Next.js
# Pressione Ctrl+C no terminal onde está rodando
# Ou encontre e mate o processo:
# Windows: netstat -ano | findstr :3001  → taskkill /F /PID <PID>
# Linux/Mac: lsof -ti:3001 | xargs kill -9
```

---

## Problemas Comuns

### `jinja2 must be installed`
```bash
# Adicionar ao requirements.txt e rebuildar
echo "jinja2>=3.1.3" >> whatsapp_automation/requirements.txt
cd whatsapp_automation && docker compose build --no-cache backend
```

### `npm ci` falha no bridge (sem package-lock.json)
O Dockerfile do bridge usa `npm install --omit=dev`. Se isso mudar para `npm ci`, gere o lockfile primeiro:
```bash
cd whatsapp_automation/whatsapp_bridge && npm install
```

### Porta 5432 ocupada
Altere o mapeamento no `docker-compose.yml` de `"5432:5432"` para `"5433:5432"` e atualize o `DATABASE_URL`.

### Prisma Client desatualizado após migrate
```bash
cd whatsapp_admin_panel/nextjs_space
npx prisma generate
# Reiniciar o servidor Next.js
```

### Celery Worker `unhealthy`
O healthcheck do Celery usa `celery inspect ping`, não HTTP. Confirme que o docker-compose.yml tem:
```yaml
celery_worker:
  healthcheck:
    test: ["CMD", "celery", "-A", "app.infrastructure.tasks.celery_app", "inspect", "ping", "--timeout=10"]
```

---

## Portas em Uso

| Serviço | Porta Host |
|---------|-----------|
| Admin Panel (Next.js) | 3001 |
| WhatsApp Bridge | 3000 |
| Backend API | 8000 |
| PostgreSQL | 5433 (mapeado de 5432 interno) |
| MongoDB | 27017 |
| Redis | 6379 |

---

## Ordem de Inicialização Resumida

```
1. docker compose up -d postgres mongodb redis    # infra
2. docker compose up -d backend celery_worker celery_beat  # backend
3. docker compose up -d whatsapp_bridge           # bridge
4. npm run dev -- --port 3001                     # painel (terminal separado)
```
