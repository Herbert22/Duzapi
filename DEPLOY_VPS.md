# Deploy DuzAPI na VPS

## Acesso

```bash
ssh root@185.173.110.162
+W+;bws8GWqTm8J'UHy4
```

## Deploy local (recomendado)

```bash
# Deploy inteligente — detecta o que mudou e só reconstrói o necessário:
./scripts/deploy-local.sh

# Forçar rebuild de todos os serviços:
./scripts/deploy-local.sh --all

# Rebuild de um serviço específico:
./scripts/deploy-local.sh --service backend       # backend + celery_worker + celery_beat
./scripts/deploy-local.sh --service admin_panel    # só o admin panel Next.js
./scripts/deploy-local.sh --service bridge         # só o WhatsApp bridge

# Só recarregar config do nginx (sem rebuild):
./scripts/deploy-local.sh --only-nginx

# Rodar migrations do Alembic após deploy:
./scripts/deploy-local.sh --migrate
```

## Deploy direto na VPS

```bash
ssh root@185.173.110.162
bash /opt/duzapi/scripts/deploy.sh              # auto-detecta mudanças
bash /opt/duzapi/scripts/deploy.sh --all        # rebuild tudo
bash /opt/duzapi/scripts/deploy.sh --skip-pull  # usa código atual sem git pull
bash /opt/duzapi/scripts/deploy.sh --help       # ver todas as opções
```
