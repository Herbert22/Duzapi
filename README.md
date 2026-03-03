# DuzAPI — WhatsApp Automation SaaS com IA

Sistema multi-tenant de chatbot para WhatsApp com Inteligência Artificial. Permite que empresas criem assistentes virtuais personalizados para atendimento automatizado via WhatsApp.

## Visão Geral

```
┌─────────────────────────────────────────────────────┐
│                    DuzAPI Stack                     │
├─────────────────┬───────────────────────────────────┤
│  Admin Panel    │  Next.js 14 + Prisma + NextAuth   │
│  (porta 3001)   │  Dashboard SaaS para clientes     │
├─────────────────┼───────────────────────────────────┤
│  Backend API    │  FastAPI + Celery + SQLAlchemy    │
│  (porta 8000)   │  Lógica de negócio e IA           │
├─────────────────┼───────────────────────────────────┤
│  WA Bridge      │  Node.js + WPPConnect             │
│  (porta 3000)   │  Conexão com WhatsApp Web         │
├─────────────────┼───────────────────────────────────┤
│  Infra          │  PostgreSQL · MongoDB · Redis     │
│                 │  Nginx · Docker Compose           │
└─────────────────┴───────────────────────────────────┘
```

## Funcionalidades

- **Personas de IA configuráveis** — Advogado, Vendedor, Atendente, etc. via system prompt
- **Gatilhos flexíveis** — Responde a todas as mensagens ou apenas por palavras-chave
- **Transcrição de áudio** — Áudios do WhatsApp transcritos via OpenAI Whisper
- **Humanização** — Delay configurável entre respostas para simular digitação humana
- **Multi-tenant** — Múltiplos clientes, cada um com suas sessões e configurações
- **Painel SaaS** — Dashboard completo com planos, assinaturas e billing

## Estrutura do Repositório

```
Duzapi/
├── whatsapp_automation/        # Backend Python (FastAPI) + Bridge Node.js
│   ├── app/                    # Código FastAPI (hexagonal architecture)
│   │   ├── api/                # Rotas HTTP
│   │   ├── application/        # Casos de uso e serviços
│   │   ├── domain/             # Entidades e regras de negócio
│   │   ├── infrastructure/     # Repositórios, Celery, OpenAI
│   │   ├── admin/              # Interface admin Jinja2
│   │   └── core/               # Config, segurança, banco de dados
│   ├── whatsapp_bridge/        # Bridge Node.js (WPPConnect)
│   ├── alembic/                # Migrations PostgreSQL
│   ├── docker-compose.yml      # Stack completa
│   ├── Dockerfile              # Imagem do backend Python
│   └── .env.example            # Variáveis de ambiente necessárias
│
├── whatsapp_admin_panel/
│   └── nextjs_space/           # Painel SaaS Next.js 14
│       ├── app/                # App Router
│       │   ├── (dashboard)/    # Páginas autenticadas
│       │   ├── (public)/       # Páginas públicas
│       │   └── api/            # API Routes (NextAuth, Asaas, proxy)
│       ├── prisma/             # Schema e migrations Prisma
│       └── lib/                # Auth, tipos, utilitários
│
├── nginx/                      # Configuração Nginx (reverse proxy + SSL)
│   ├── nginx.conf
│   └── conf.d/duzapi.conf
│
└── scripts/                    # Scripts de operação
    ├── backup.sh               # Backup PostgreSQL + MongoDB
    └── restore.sh              # Restore de backups
```

## Início Rápido

Consulte [COMO_EXECUTAR.md](COMO_EXECUTAR.md) para instruções detalhadas de execução local e produção.

## Tech Stack

| Componente | Tecnologia |
|------------|-----------|
| Backend API | Python 3.11, FastAPI, SQLAlchemy (async) |
| Task Queue | Celery + Redis |
| IA | OpenAI GPT-4 + Whisper |
| WhatsApp | WPPConnect (Node.js 18) |
| Banco Relacional | PostgreSQL 15 |
| Banco de Logs | MongoDB 6 |
| Cache/Broker | Redis 7 |
| Admin Panel | Next.js 14, TypeScript, Tailwind, Prisma |
| Auth | NextAuth.js (email + Google OAuth) |
| Pagamentos | Asaas |
| Proxy | Nginx (SSL via Let's Encrypt) |
| Infra | Docker Compose |

## Variáveis de Ambiente

Copie `.env.example` para `.env` dentro de `whatsapp_automation/` e preencha as variáveis obrigatórias:

```bash
cp whatsapp_automation/.env.example whatsapp_automation/.env
```

Variáveis obrigatórias:
- `SECRET_KEY` — chave secreta da API (64 hex chars)
- `BRIDGE_AUTH_TOKEN` — token de auth entre backend e bridge
- `WEBHOOK_SECRET` — segredo HMAC para webhooks
- `ENCRYPTION_KEY` — chave Fernet para encriptar API keys
- `POSTGRES_PASSWORD` — senha do PostgreSQL
- `MONGO_PASSWORD` — senha do MongoDB
- `REDIS_PASSWORD` — senha do Redis

## Licença

Proprietário — Todos os direitos reservados.
