# DuzAPI - Plataforma SaaS de Automacao WhatsApp com IA

Sistema completo de automacao e chatbot com IA para WhatsApp, com arquitetura multi-tenant, funis visuais de mensagens e integracoes com IA.

## Indice

- [Caracteristicas](#caracteristicas)
- [Arquitetura](#arquitetura)
- [Tech Stack](#tech-stack)
- [Instalacao](#instalacao)
- [Configuracao](#configuracao)
- [Uso](#uso)
  - [Fluxo Basico](#fluxo-basico)
  - [Funis de Mensagens](#funis-de-mensagens)
  - [Configuracao de Bot (IA Fallback)](#configuracao-de-bot-ia-fallback)
- [API Documentation](#api-documentation)
- [Deploy em Producao](#deploy-em-producao)

## Caracteristicas

- **Multi-tenant**: Suporte a multiplos clientes/empresas isolados
- **Funis Visuais**: Editor drag-and-drop para fluxos de conversa automatizados (similar ManyChat/Typebot)
- **Chatbot com IA**: Integracao com Google Gemini e OpenAI GPT para respostas inteligentes
- **Transcricao de Audio**: Converte audios em texto usando Whisper
- **Humanizacao**: Delays configuraveis para simular digitacao humana
- **Triggers Flexiveis**: Funis ativados por palavras-chave, IA responde ao restante
- **Personas Customizaveis**: System prompts configuraveis por tenant
- **Admin Panel Next.js**: Dashboard moderno com autenticacao, subscricoes e gerenciamento completo
- **Logs Completos**: Historico de conversas no MongoDB
- **Processamento Assincrono**: Celery para tarefas em background
- **SaaS Ready**: Sistema de assinaturas com Asaas, rate limiting, audit logs

## Arquitetura

```
                        +-------------------+
                        |   Admin Panel     |
                        |   (Next.js 14)    |
                        |   :3001           |
                        +--------+----------+
                                 |
                        +--------v----------+
                        |      Nginx        |
                        |  (Reverse Proxy)  |
                        |   :80 / :443      |
                        +--------+----------+
                                 |
              +------------------+------------------+
              |                                     |
    +---------v---------+              +------------v-----------+
    |   FastAPI Backend |              |   WhatsApp Bridge      |
    |   :8000           |              |   (WPPConnect/Node.js) |
    |   - REST API      |              |   :3000                |
    |   - Admin routes  |              +------------+-----------+
    |   - Webhooks      |                           |
    +---------+---------+              Envia/Recebe mensagens
              |                        via WhatsApp Web
    +---------v---------+
    |   Celery Workers  |
    |   - Funnel engine |
    |   - AI processing |
    |   - Audio transc. |
    +---+-------+-------+
        |       |
   +----v--+ +--v-----+ +--------+
   |Postgre| |MongoDB | | Redis  |
   |SQL    | |(logs)  | |(broker)|
   +-------+ +--------+ +--------+
```

### Roteamento de Mensagens (Webhook)

Quando uma mensagem chega, o sistema segue esta prioridade:

1. **Sessao de funil ativa** -> Retoma o funil existente para o contato
2. **Trigger de funil** -> Se o texto bate com keywords de um funil ativo, inicia o funil
3. **Bot Config (IA fallback)** -> Se nenhum funil se aplica, usa resposta IA configurada

## Tech Stack

| Componente | Tecnologia |
|------------|------------|
| **Backend** | FastAPI (Python 3.11+) |
| **ORM** | SQLAlchemy 2.0 (async) |
| **BD Relacional** | PostgreSQL 15 |
| **BD Documentos** | MongoDB 6 (logs + sessoes de funil) |
| **Cache/Broker** | Redis 7 |
| **Task Queue** | Celery (sync workers) |
| **IA** | Google Gemini (gemini-2.5-flash-lite) + OpenAI Whisper |
| **Admin Panel** | Next.js 14 + Tailwind + shadcn/ui |
| **Flow Editor** | @xyflow/react v12 (React Flow) |
| **WhatsApp** | WPPConnect (Node.js) |
| **Pagamentos** | Asaas (gateway BR) |
| **Containers** | Docker + Docker Compose |

## Instalacao

### Com Docker (Recomendado)

```bash
# 1. Clone o repositorio
git clone https://github.com/Herbert22/Duzapi.git
cd Duzapi/whatsapp_automation

# 2. Configure variaveis de ambiente
cp .env.example .env
nano .env  # Preencha as credenciais

# 3. Suba os containers
docker compose up -d --build

# 4. Verifique o status
docker compose ps
```

### Portas dos servicos

| Servico | Porta | URL |
|---------|-------|-----|
| Admin Panel (Next.js) | 3001 | http://localhost:3001 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| WhatsApp Bridge | 3000 | http://localhost:3000 |
| Swagger Docs | 8000 | http://localhost:8000/docs |

## Configuracao

### Variaveis de Ambiente Essenciais

| Variavel | Descricao |
|----------|-----------|
| `SECRET_KEY` | Chave secreta para JWT/seguranca |
| `ENCRYPTION_KEY` | Chave Fernet para encriptar API keys |
| `BRIDGE_AUTH_TOKEN` | Token compartilhado entre backend e bridge |
| `DATABASE_URL` | URL PostgreSQL (async: postgresql+asyncpg://...) |
| `MONGODB_URL` | URL MongoDB |
| `MONGODB_DB` | Nome do database MongoDB |
| `REDIS_URL` | URL do Redis |
| `GOOGLE_API_KEY` | Chave da API Gemini (para IA) |
| `NEXTAUTH_URL` | URL publica do admin panel |
| `NEXTAUTH_SECRET` | Segredo do NextAuth.js |
| `ASAAS_API_KEY` | Chave Asaas (pagamentos, opcional) |

## Uso

### Fluxo Basico

1. **Acesse o Admin Panel** -> http://localhost:3001 (ou seu dominio)
2. **Crie uma conta** na tela de login
3. **Crie um Tenant** (menu Inquilinos) — representa sua empresa/numero
4. **Conecte o WhatsApp** (menu WhatsApp) — escaneie o QR Code
5. **Configure respostas** via Funil ou Bot Config (veja abaixo)

### Funis de Mensagens

Os funis sao fluxos visuais de conversa automatizados. E a forma principal de criar automacoes.

#### Criando um Funil

1. Acesse **Funis de Mensagens** no menu lateral
2. Clique **Novo Funil** — preencha nome, selecione o tenant e adicione palavras-chave de gatilho
3. Voce sera redirecionado ao **Editor Visual**

#### Editor Visual (React Flow)

O editor tem uma barra lateral com os tipos de blocos disponiveis. Arraste para a area de trabalho e conecte:

| Tipo de Bloco | Descricao | Configuracao |
|---------------|-----------|--------------|
| **Inicio** | Ponto de entrada do funil (obrigatorio, 1 por funil) | Nenhuma |
| **Enviar Texto** | Envia mensagem de texto | `text`: mensagem (suporta variaveis `{nome}`) |
| **Enviar Imagem** | Envia imagem com legenda opcional | `url`: URL da imagem, `caption`: legenda |
| **Enviar Audio** | Envia arquivo de audio | `url`: URL do audio |
| **Enviar Video** | Envia video com legenda | `url`: URL do video, `caption`: legenda |
| **Enviar Documento** | Envia documento/arquivo | `url`: URL do documento, `filename`: nome |
| **Aguardar** | Pausa antes do proximo bloco | `seconds`: tempo em segundos |
| **Perguntar** | Envia pergunta e aguarda resposta | `question`: texto, `variable`: nome da variavel, `timeout_seconds`: timeout |
| **Condicao** | Bifurca o fluxo com base em variavel | `variable`: variavel, arestas com `condition_label`/`condition_value` |
| **Tag** | Aplica tag ao contato | `tag`: nome da tag |
| **Resposta IA** | Gera resposta com IA (Gemini/GPT) | `prompt`: instrucao para a IA |

#### Exemplo de Funil

```
[Inicio] -> [Enviar Texto: "Ola! Qual procedimento voce procura?"]
         -> [Perguntar: variavel="procedimento"]
         -> [Condicao: variavel="procedimento"]
              |-- "bariatrica" -> [Enviar Texto: "Otimo! A cirurgia bariatrica..."]
              |-- "rinoplastia" -> [Enviar Texto: "A rinoplastia e um..."]
              |-- (padrao) -> [Resposta IA: "Responda sobre o procedimento"]
         -> [Tag: "lead_qualificado"]
```

#### Variaveis

Nos blocos de texto voce pode usar `{nome_da_variavel}` que sera substituido pelo valor coletado:
- Variaveis criadas por blocos **Perguntar** (o `variable` definido)
- Variaveis de sistema: `{sender_phone}` (telefone do contato)

#### Ativando o Funil

1. Adicione pelo menos uma **palavra-chave de gatilho** (ex: "bariatrica", "preco", "orcamento")
2. Certifique-se de ter um bloco **Inicio** conectado
3. Clique no botao **Ativar** (icone play) na lista de funis ou salve com "Ativo" marcado
4. Quando um contato enviar uma mensagem contendo a keyword, o funil sera iniciado automaticamente

#### Prioridade

Se multiplos funis correspondem a mesma mensagem, o de maior `priority` (numero) ganha. O padrao e 0.

### Configuracao de Bot (IA Fallback)

O Bot Config e o "cerebro padrao" — responde quando nenhum funil se aplica.

1. Acesse **Configuracoes de Bot** no menu lateral
2. Crie uma configuracao para seu tenant:
   - **Nome da Persona**: nome do assistente (ex: "Clara")
   - **System Prompt**: instrucao de comportamento da IA
   - **Provedor de IA**: Gemini ou OpenAI + API key
   - **Modo de Gatilho**: `all` (responde tudo) ou `keywords` (so palavras-chave)
   - **Delay**: tempo minimo/maximo de espera antes de responder (humanizacao)
   - **Resposta por Audio**: ativa TTS (text-to-speech)
   - **Mensagem Inicial**: mensagem enviada no primeiro contato
3. Ative a configuracao

#### Coexistencia Funis + Bot Config

- Funis tem **prioridade** — se uma mensagem bate com trigger de funil, o funil executa
- Se nenhum funil se aplica, a mensagem vai para o **Bot Config** (IA)
- Um funil pode conter blocos de **Resposta IA** que usam a IA dentro do fluxo
- Enquanto um contato esta em um funil ativo, todas as mensagens dele vao para o funil (ate concluir)

## API Documentation

Documentacao interativa: http://localhost:8000/docs

### Endpoints Principais

#### Funnels (Admin)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `GET` | `/api/v1/admin/funnels/` | Listar funis |
| `POST` | `/api/v1/admin/funnels/` | Criar funil |
| `GET` | `/api/v1/admin/funnels/{id}` | Obter funil com grafo |
| `PUT` | `/api/v1/admin/funnels/{id}` | Atualizar metadados |
| `PUT` | `/api/v1/admin/funnels/{id}/graph` | Salvar grafo completo (nos + arestas) |
| `DELETE` | `/api/v1/admin/funnels/{id}` | Excluir funil |

#### Tenants
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/api/v1/tenants/` | Criar tenant |
| `GET` | `/api/v1/tenants/` | Listar tenants |
| `PUT` | `/api/v1/tenants/{id}` | Atualizar tenant |
| `DELETE` | `/api/v1/tenants/{id}` | Excluir tenant |

#### Bot Configs (Admin)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/api/v1/admin/bot-configs/` | Criar config |
| `GET` | `/api/v1/admin/bot-configs/` | Listar configs |
| `PUT` | `/api/v1/admin/bot-configs/{id}` | Atualizar config |
| `DELETE` | `/api/v1/admin/bot-configs/{id}` | Excluir config |

#### Messages (Admin)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `GET` | `/api/v1/admin/messages/` | Listar mensagens |
| `GET` | `/api/v1/admin/messages/conversations` | Listar conversas |

#### Webhooks
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/api/v1/webhooks/whatsapp` | Receber mensagens do bridge |

### Autenticacao

- **Admin routes** (`/api/v1/admin/*`): Bearer token (`BRIDGE_AUTH_TOKEN`)
- **Tenant routes** (`/api/v1/tenants/*`): Bearer token (`BRIDGE_AUTH_TOKEN`)
- **Public routes** (`/api/v1/webhooks/*`): HMAC signature (`X-Bridge-Signature`)

## Deploy em Producao

Consulte [DEPLOY_VPS.md](../DEPLOY_VPS.md) para o guia completo de deploy.

### Comandos uteis

```bash
# Atualizar codigo na VPS
cd /opt/duzapi && git pull origin main
cd whatsapp_automation && docker compose up -d --build

# Ver logs
docker compose logs -f backend
docker compose logs -f celery_worker

# Backup PostgreSQL
docker exec wa_postgres pg_dump -U whatsapp whatsapp_automation | gzip > backup_pg_$(date +%Y%m%d).sql.gz

# Backup MongoDB
docker exec wa_mongodb mongodump --username whatsapp --password "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > backup_mongo_$(date +%Y%m%d).gz
```

## Estrutura do Projeto

```
whatsapp_automation/
  app/
    api/
      routes/
        admin_funnels.py    # CRUD funis (admin)
        admin_bot_config.py # CRUD bot configs (admin)
        admin_messages.py   # Mensagens (admin)
        webhooks.py         # Webhook WhatsApp
        tenants.py          # CRUD tenants
      schemas/
        funnel.py           # Schemas Pydantic (funis)
    application/
      services/             # Servicos de dominio
    core/
      config.py             # Settings
      database.py           # Conexoes BD (PostgreSQL + MongoDB)
      redis_client.py       # Redis client
      security.py           # Autenticacao
    domain/
      entities/
        funnel.py           # Funnel, FunnelNode, FunnelEdge, ContactTag
        tenant.py           # Tenant
        bot_config.py       # BotConfig
        message_log.py      # MessageLog
    infrastructure/
      repositories/
        funnel_repository.py    # Repositorio funis (PostgreSQL)
      tasks/
        funnel_tasks.py     # Engine de execucao de funis (Celery)
        message_tasks.py    # Processamento IA (Celery)
  whatsapp_bridge/          # Servico WhatsApp (Node.js + WPPConnect)
  main.py                   # Entry point FastAPI
  docker-compose.yml        # Orquestracao
  Dockerfile                # Imagem backend

whatsapp_admin_panel/
  nextjs_space/
    app/
      (dashboard)/
        funnels/
          page.tsx          # Lista de funis
          [id]/page.tsx     # Editor visual (React Flow)
        bot-config/         # Config de bot (IA)
        messages/           # Historico de mensagens
        whatsapp/           # Gerenciamento de sessoes
      api/
        proxy/[...path]/    # Proxy para backend
        auth/               # NextAuth.js
        subscription/       # Assinaturas Asaas
```

---

Desenvolvido por Herbert | DuzAPI - duzapi.com.br
