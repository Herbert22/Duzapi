# 🤖 WhatsApp Automation - Sistema de Chatbot com IA

Sistema completo de automação e chatbot com IA para WhatsApp, construído com arquitetura hexagonal, multi-tenant e integração com OpenAI GPT-4.

## 📋 Índice

- [Características](#-características)
- [Arquitetura](#-arquitetura)
- [Tech Stack](#-tech-stack)
- [Instalação](#-instalação)
  - [Com Docker (Recomendado)](#com-docker-recomendado)
  - [Instalação Local](#instalação-local)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [API Documentation](#-api-documentation)
- [Interface Admin](#-interface-admin)
- [Exemplos de Uso](#-exemplos-de-uso)
- [Desenvolvimento](#-desenvolvimento)

## ✨ Características

- **Multi-tenant**: Suporte a múltiplos clientes/empresas
- **Chatbot com IA**: Integração com OpenAI GPT-4 para respostas inteligentes
- **Transcrição de Áudio**: Converte áudios em texto usando Whisper
- **Humanização**: Delays configuráveis para simular digitação humana
- **Triggers Flexíveis**: Responde a todas mensagens ou apenas palavras-chave
- **Personas Customizáveis**: System prompts configuráveis por tenant
- **Interface Admin**: Dashboard web para gerenciamento
- **Logs Completos**: Histórico de conversas no MongoDB
- **Processamento Assíncrono**: Celery para tarefas em background

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │  Webhooks   │  │     Admin Interface     │  │
│  │  (FastAPI)  │  │ (WhatsApp)  │  │       (Jinja2)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Message Processor   │  │         Use Cases                │ │
│  │  (AI + Transcription)│  │  (Tenant, Config, Message CRUD)  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Tenant    │  │  BotConfig  │  │      MessageLog         │  │
│  │  (Entity)   │  │  (Entity)   │  │       (Entity)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                         │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────┐  │
│  │PostgreSQL │  │  MongoDB  │  │   Redis    │  │   OpenAI    │  │
│  │(Tenants)  │  │  (Logs)   │  │  (Celery)  │  │  (GPT-4)    │  │
│  └───────────┘  └───────────┘  └────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠 Tech Stack

| Componente | Tecnologia |
|------------|------------|
| **Backend** | FastAPI 0.109+ |
| **ORM** | SQLAlchemy 2.0 (async) |
| **BD Relacional** | PostgreSQL 15 |
| **BD Documentos** | MongoDB 6 |
| **Cache/Broker** | Redis 7 |
| **Task Queue** | Celery |
| **IA** | OpenAI GPT-4 + Whisper |
| **Templates** | Jinja2 + Bootstrap 5 |
| **WhatsApp** | WPPConnect (Node.js) |
| **Containers** | Docker + Docker Compose |

## 📦 Instalação

### Com Docker (Recomendado)

1. **Clone o repositório**
```bash
git clone <repository-url>
cd whatsapp_automation
```

2. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

3. **Inicie os containers**
```bash
# Modo desenvolvimento
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f backend
```

4. **Acesse a aplicação**
- API: http://localhost:8000
- Admin: http://localhost:8000/admin
- Docs: http://localhost:8000/docs

5. **Comandos úteis**
```bash
# Parar todos os serviços
docker-compose down

# Reconstruir imagens
docker-compose build --no-cache

# Ver logs de um serviço específico
docker-compose logs -f celery_worker

# Executar migrations
docker-compose exec backend alembic upgrade head

# Acessar shell do container
docker-compose exec backend bash
```

### Instalação Local

1. **Pré-requisitos**
- Python 3.11+
- PostgreSQL 15+
- MongoDB 6+
- Redis 7+

2. **Clone e configure**
```bash
git clone <repository-url>
cd whatsapp_automation

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o .env com as configurações locais
```

4. **Inicialize os bancos de dados**
```bash
# PostgreSQL - criar database
createdb whatsapp_automation

# Executar migrations (se usar Alembic)
alembic upgrade head
```

5. **Inicie a aplicação**
```bash
# Terminal 1 - API
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Celery Worker
celery -A app.infrastructure.tasks.celery_app worker --loglevel=info

# Terminal 3 - Celery Beat (opcional, para tarefas agendadas)
celery -A app.infrastructure.tasks.celery_app beat --loglevel=info
```

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DEBUG` | Modo debug | `false` |
| `SECRET_KEY` | Chave secreta para JWT | - |
| `DATABASE_URL` | URL do PostgreSQL (async) | - |
| `MONGODB_URL` | URL do MongoDB | - |
| `MONGODB_DATABASE` | Nome do database MongoDB | `whatsapp_automation` |
| `REDIS_URL` | URL do Redis | `redis://localhost:6379/0` |
| `OPENAI_API_KEY` | Chave da API OpenAI | - |
| `WPPCONNECT_SERVER_URL` | URL do servidor WPPConnect | - |

### Exemplo de .env
```env
DEBUG=true
SECRET_KEY=sua-chave-secreta-aqui
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/whatsapp_automation
SYNC_DATABASE_URL=postgresql://user:pass@localhost:5432/whatsapp_automation
MONGODB_URL=mongodb://user:pass@localhost:27017
MONGODB_DATABASE=whatsapp_automation
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
WPPCONNECT_SERVER_URL=http://localhost:21465
```

## 📱 WhatsApp Bridge

O serviço WhatsApp Bridge (Node.js + WPPConnect) é responsável pela comunicação com o WhatsApp.

### Iniciar uma Sessão WhatsApp

```bash
# Iniciar sessão para um tenant
curl -X POST "http://localhost:3000/api/sessions/minha-empresa/start" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "uuid-do-tenant"}'

# Resposta contém o QR Code em base64
{
  "success": true,
  "status": "qr_code",
  "sessionId": "minha-empresa",
  "qrCode": "data:image/png;base64,..."
}
```

### Verificar Status da Sessão

```bash
curl http://localhost:3000/api/sessions/minha-empresa/status
```

### Endpoints do WhatsApp Bridge

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/sessions` | Lista todas as sessões |
| `POST` | `/api/sessions/:id/start` | Inicia uma sessão |
| `POST` | `/api/sessions/:id/stop` | Para uma sessão |
| `GET` | `/api/sessions/:id/status` | Status da sessão |
| `GET` | `/api/sessions/:id/qrcode` | Obtém QR Code |
| `POST` | `/api/send-message` | Envia mensagem |
| `GET` | `/api/health` | Health check |

Para mais detalhes, consulte o [README do WhatsApp Bridge](./whatsapp_bridge/README.md).

## 🚀 Uso

### Fluxo Básico

1. **Criar um Tenant** (via API ou Admin)
2. **Guardar a API Key** gerada
3. **Criar uma Configuração de Bot** para o tenant
4. **Iniciar sessão WhatsApp** no Bridge
5. **Escanear QR Code** com o celular
6. **Testar** enviando mensagens

## 📚 API Documentation

A documentação interativa está disponível em:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Endpoints Principais

#### Tenants
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/tenants` | Criar tenant |
| `GET` | `/api/v1/tenants` | Listar tenants |
| `GET` | `/api/v1/tenants/{id}` | Obter tenant |
| `PUT` | `/api/v1/tenants/{id}` | Atualizar tenant |
| `DELETE` | `/api/v1/tenants/{id}` | Excluir tenant |
| `POST` | `/api/v1/tenants/{id}/regenerate-key` | Regenerar API Key |

#### Bot Configs
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/bot-configs` | Criar config |
| `GET` | `/api/v1/bot-configs` | Listar configs |
| `GET` | `/api/v1/bot-configs/{id}` | Obter config |
| `PUT` | `/api/v1/bot-configs/{id}` | Atualizar config |
| `DELETE` | `/api/v1/bot-configs/{id}` | Excluir config |
| `POST` | `/api/v1/bot-configs/{id}/activate` | Ativar config |

#### Messages
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/v1/messages` | Listar mensagens |
| `GET` | `/api/v1/messages/conversation/{phone}` | Histórico conversa |
| `GET` | `/api/v1/messages/stats` | Estatísticas |

#### Webhooks
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/v1/webhooks/whatsapp` | Receber mensagens WPPConnect |

### Autenticação

As rotas protegidas requerem o header `X-API-Key`:

```bash
curl -X GET "http://localhost:8000/api/v1/bot-configs" \
  -H "X-API-Key: sua-api-key-aqui"
```

## 🖥 Interface Admin

Acesse http://localhost:8000/admin para:

- **Dashboard**: Visão geral com estatísticas
- **Tenants**: Gerenciar clientes/empresas
- **Configurações**: Definir personas e triggers
- **Logs**: Visualizar histórico de conversas

## 📝 Exemplos de Uso

### Criar Tenant via API

```bash
curl -X POST "http://localhost:8000/api/v1/tenants" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Minha Empresa",
    "phone_number": "5511999999999"
  }'
```

**Resposta:**
```json
{
  "id": "uuid-do-tenant",
  "name": "Minha Empresa",
  "phone_number": "5511999999999",
  "is_active": true,
  "api_key": "wa_abc123..."  // GUARDAR ESTA CHAVE!
}
```

### Criar Configuração de Bot

```bash
curl -X POST "http://localhost:8000/api/v1/bot-configs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wa_abc123..." \
  -d '{
    "tenant_id": "uuid-do-tenant",
    "persona_name": "Assistente Vendas",
    "system_prompt": "Você é um assistente de vendas amigável da empresa X. Responda de forma clara e objetiva.",
    "trigger_mode": "all",
    "delay_min": 2,
    "delay_max": 5,
    "is_active": true
  }'
```

### Configurar Webhook WPPConnect

Configure o WPPConnect para enviar webhooks para:
```
POST http://seu-servidor:8000/api/v1/webhooks/whatsapp
```

### Consultar Histórico de Conversa

```bash
curl -X GET "http://localhost:8000/api/v1/messages/conversation/5511888888888?limit=20" \
  -H "X-API-Key: wa_abc123..."
```

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
whatsapp_automation/
├── app/
│   ├── admin/                 # Interface administrativa
│   │   ├── routes.py          # Rotas do admin
│   │   └── templates/         # Templates Jinja2
│   ├── api/                   # Camada de apresentação
│   │   ├── routes/            # Endpoints da API
│   │   ├── schemas/           # Schemas Pydantic
│   │   └── dependencies/      # Dependências (auth, etc)
│   ├── application/           # Camada de aplicação
│   │   └── services/          # Serviços e casos de uso
│   ├── core/                  # Configurações core
│   │   ├── config.py          # Settings
│   │   ├── database.py        # Conexões BD
│   │   └── security.py        # Autenticação
│   ├── domain/                # Camada de domínio
│   │   └── entities/          # Entidades/Models
│   └── infrastructure/        # Camada de infraestrutura
│       ├── external_services/ # Integrações externas
│       ├── repositories/      # Repositórios
│       └── tasks/             # Tasks Celery
├── whatsapp_bridge/           # Serviço WhatsApp (Node.js)
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── config/            # Configurações
│   │   ├── services/          # Session manager, Message handler
│   │   ├── routes/            # API REST
│   │   └── utils/             # Logger
│   ├── Dockerfile             # Imagem Docker Node.js
│   └── package.json           # Dependências Node.js
├── main.py                    # Ponto de entrada
├── requirements.txt           # Dependências Python
├── Dockerfile                 # Imagem Docker Backend
├── docker-compose.yml         # Orquestração
└── .env.example               # Exemplo de configuração
```

### Rodar Testes

```bash
# Instalar dependências de teste
pip install pytest pytest-asyncio pytest-cov

# Rodar testes
pytest

# Com cobertura
pytest --cov=app --cov-report=html
```

### Migrations com Alembic

```bash
# Criar nova migration
alembic revision --autogenerate -m "descrição da mudança"

# Aplicar migrations
alembic upgrade head

# Reverter última migration
alembic downgrade -1
```

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

Desenvolvido com ❤️ usando FastAPI + OpenAI
