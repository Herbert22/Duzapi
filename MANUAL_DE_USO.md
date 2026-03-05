# Manual de Uso — DuzAPI

Guia completo para utilização do sistema de automação WhatsApp com IA.

---

## Índice

1. [Primeiro Acesso](#1-primeiro-acesso)
2. [Dashboard](#2-dashboard)
3. [Gerenciar Tenants](#3-gerenciar-tenants)
4. [Configurar Bot (Persona, Gatilhos, Delay)](#4-configurar-bot)
5. [Conectar WhatsApp](#5-conectar-whatsapp)
6. [Logs de Conversa](#6-logs-de-conversa)
7. [Billing e Assinaturas](#7-billing-e-assinaturas)
8. [Fluxo Completo: Do Zero à Primeira Resposta](#8-fluxo-completo)
9. [API Backend (Swagger)](#9-api-backend)
10. [Painel Admin (Jinja2)](#10-painel-admin-jinja2)
11. [Referência de URLs](#11-referência-de-urls)

---

## 1. Primeiro Acesso

### Login

Acesse **http://localhost:3001/login** e entre com:

- **Email + Senha** — formulário de login padrão
- **Google** — botão "Continuar com Google"

### Criar Conta

1. Acesse **http://localhost:3001/landing** e clique em "Comece Grátis por 7 Dias"
2. Preencha Nome, Email, Senha e Confirmar Senha
3. Um código de 6 dígitos será enviado por email
4. Digite o código na tela de verificação
5. Você será redirecionado para a tela de checkout

### Recuperar Senha

1. Na tela de login, clique em **"Esqueci minha senha"**
2. Informe seu email
3. Um link de redefinição será enviado
4. Clique no link e defina uma nova senha

---

## 2. Dashboard

**URL:** http://localhost:3001/dashboard

O dashboard exibe uma visão geral do sistema:

### Cards de Estatísticas (topo)

| Card | Descrição |
|------|-----------|
| Total de Tenants | Quantidade de clientes cadastrados |
| Configurações Ativas | Bots ativos no momento |
| Mensagens (24h) | Mensagens nas últimas 24 horas |
| Total de Mensagens | Total histórico de mensagens |

### Gráficos

- **Desempenho por Tenant** — barras mostrando mensagens por cliente
- **Taxa de Resposta da IA** — percentual de mensagens respondidas
- **Tempo de Resposta** — tempo médio de resposta em segundos
- **Mensagens por Período** — alternável entre Hora / Dia / Semana
- **Tendência de Mensagens** — evolução ao longo do tempo
- **Tipos de Mensagem** — proporção Texto vs. Áudio

### Mensagens Recentes

Lista das 5 últimas mensagens recebidas com:
- Telefone do remetente
- Tipo (texto/áudio)
- Conteúdo da mensagem
- Preview da resposta da IA
- Horário

---

## 3. Gerenciar Tenants

**URL:** http://localhost:3001/tenants

Tenant = cliente/empresa que usa o sistema. Cada tenant tem seu próprio número de WhatsApp e configurações.

### Criar Tenant

1. Clique em **"Novo Tenant"**
2. Preencha:
   - **Nome** — nome do cliente (ex: "Loja X")
   - **Telefone** — número do WhatsApp com DDD e código do país (ex: `+5511999999999`)
3. Clique em **"Criar"**
4. **Anote a API Key** — ela é exibida apenas uma vez

### Tabela de Tenants

| Coluna | Descrição |
|--------|-----------|
| Nome | Nome do tenant |
| Telefone | Número do WhatsApp |
| API Key | Chave truncada + botão para copiar |
| Status | Badge "Ativo" (verde) ou "Inativo" (vermelho) |
| Ações | Botões de ação |

### Ações por Tenant

| Botão | Ação |
|-------|------|
| ⚡ (power) | Ativar / Desativar o tenant |
| ✏️ (editar) | Editar nome e telefone |
| 🗑️ (deletar) | Excluir o tenant (com confirmação) |
| 🔄 (regenerar) | Gerar nova API Key (invalida a anterior) |

---

## 4. Configurar Bot

**URL:** http://localhost:3001/bot-configs

Aqui você define **como o bot se comporta** para cada tenant.

### Criar Configuração

1. Clique em **"Nova Configuração"**
2. Preencha os campos:

#### Campos do Formulário

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **Tenant** | Selecione o cliente | "Loja X" |
| **Nome da Persona** | Identidade do bot | "Assistente de Vendas" |
| **System Prompt** | Instruções de comportamento da IA | "Você é um atendente da Loja X. Seja educado, responda em português..." |
| **Delay Mínimo (s)** | Tempo mínimo antes de responder | 1 |
| **Delay Máximo (s)** | Tempo máximo antes de responder | 5 |
| **Modo de Resposta** | Quando o bot deve responder | Ver abaixo |
| **Palavras-chave** | Lista de gatilhos (se modo keywords) | "oi", "olá", "preço" |
| **OpenAI API Key** | Chave da API OpenAI | sk-... |

#### Modo de Resposta (Triggers)

- **"Responder a todas"** — o bot responde a **qualquer** mensagem recebida
- **"Apenas palavras-chave"** — o bot só responde se a mensagem contém uma das palavras-chave configuradas

#### Adicionar Palavras-chave

Quando o modo é "Apenas palavras-chave":
1. Digite a palavra no campo de texto
2. Pressione **Enter** ou clique no botão **"+"**
3. A palavra aparece como uma tag
4. Clique no **"×"** na tag para remover

#### Delay (Humanização)

O delay simula o tempo que um humano levaria para digitar. O sistema espera um tempo aleatório entre o mínimo e o máximo antes de enviar cada resposta.

**Exemplo:** Com delay 2-5s, se o bot recebe uma mensagem às 10:00:00, a resposta será enviada entre 10:00:02 e 10:00:05.

### Cards de Configuração

Cada card mostra:
- Nome da persona + nome do tenant
- Status (Ativo/Inativo)
- Preview do system prompt (2 linhas)
- Delay configurado (ex: "2-5s")
- Modo de trigger (Todas / Keywords)
- Até 3 palavras-chave visíveis

### Ações por Configuração

| Botão | Ação |
|-------|------|
| ⚡ (power) | Ativar/Desativar esta configuração |
| ✏️ (editar) | Editar todos os campos |
| 🗑️ (deletar) | Excluir configuração |

> **Importante:** Apenas uma configuração pode estar ativa por tenant. Ao ativar uma, as demais daquele tenant são desativadas.

---

## 5. Conectar WhatsApp

**URL:** http://localhost:3001/whatsapp

### Criar Sessão

1. Clique em **"Nova Sessão"**
2. Preencha:
   - **ID da Sessão** — identificador único (ex: "loja-x-principal")
   - **Vincular a Tenant** — selecione o tenant (opcional, pode vincular depois)
3. Clique em **"Criar e Iniciar"**
4. O QR Code será exibido automaticamente

### Escanear QR Code

1. Clique no botão **"QR Code"** na sessão
2. No celular, abra o WhatsApp → **Configurações → Dispositivos Vinculados → Vincular Dispositivo**
3. Escaneie o QR Code exibido na tela
4. Aguarde o status mudar para **"Conectado"** (verde)

> **Dica:** O QR Code expira em 2 minutos. Clique em "Atualizar QR" para gerar um novo.

### Status das Sessões

| Status | Cor | Significado |
|--------|-----|-------------|
| Conectado | Verde | WhatsApp ativo e pronto para receber mensagens |
| Conectando | Amarelo | Estabelecendo conexão |
| Aguardando QR | Amarelo | Esperando o escaneamento do QR Code |
| Desconectado | Cinza | Sessão parada ou desconectada |

### Vincular Tenant à Sessão

Se não vinculou na criação:
1. No card da sessão, use o dropdown **"Vincular a Tenant"**
2. Selecione o tenant desejado
3. O vínculo é feito automaticamente

### Iniciar / Parar Sessão

- Botão **verde (play)** — Iniciar sessão
- Botão **vermelho (stop)** — Parar sessão

---

## 6. Logs de Conversa

**URL:** http://localhost:3001/messages

### Filtros

| Filtro | Opções |
|--------|--------|
| Busca | Pesquisa por conteúdo da mensagem ou telefone |
| Tenant | Dropdown para filtrar por cliente específico |
| Tipo | Todos, Texto, Áudio, Imagem |

### Lista de Mensagens

Cada mensagem mostra:
- Ícone do tipo (🎤 áudio, 📝 texto)
- Telefone do remetente
- Badge do tipo de mensagem
- Nome do tenant
- Conteúdo da mensagem do usuário
- Preview da resposta da IA (2 linhas)
- Horário

### Ver Detalhes

Clique no ícone 👁️ (olho) para abrir o modal de detalhes:

| Campo | Descrição |
|-------|-----------|
| Remetente | Número de telefone do usuário |
| Mensagem Original | Texto enviado pelo usuário (ou URL do áudio) |
| Transcrição | Texto gerado pelo Whisper (apenas para áudios) |
| Resposta da IA | Resposta completa gerada pelo GPT-4 |
| Processado em | Horário em que a mensagem foi recebida |
| Resposta enviada em | Horário em que a resposta foi enviada |

### Paginação

Quando há mais de 10 mensagens, use as setas ← → para navegar entre páginas.

---

## 7. Billing e Assinaturas

**URL:** http://localhost:3001/billing

### Informações do Plano

- Nome do plano (Mensal / Anual)
- Status (Trial ativo, Ativo, Inativo)
- Se trial: dias restantes exibidos
- Se ativo: data de renovação
- Link para gerenciar assinatura no Asaas

### Limites de Uso

| Recurso | Trial | Plano Pago |
|---------|-------|------------|
| Instâncias WhatsApp (Tenants) | 1 | 5+ |
| Mensagens / mês | 500 | 10.000+ |

### Planos Disponíveis

| Plano | Preço |
|-------|-------|
| Mensal | R$ 99,90/mês |
| Anual | R$ 99,90/mês (faturado anualmente) |

O trial gratuito de 7 dias é ativado na primeira assinatura.

---

## 8. Fluxo Completo

Passo a passo para configurar do zero e receber a primeira resposta automática:

```
Passo 1: Criar Tenant
├── Tenants → "Novo Tenant"
├── Nome: "Minha Empresa"
├── Telefone: "+5511999999999"
└── Anotar a API Key gerada

Passo 2: Conectar WhatsApp
├── WhatsApp → "Nova Sessão"
├── ID: "minha-empresa"
├── Vincular ao tenant "Minha Empresa"
├── Escanear QR Code com o celular
└── Aguardar status "Conectado"

Passo 3: Configurar Bot
├── Bot Configs → "Nova Configuração"
├── Tenant: "Minha Empresa"
├── Persona: "Atendente Virtual"
├── System Prompt: "Você é um atendente virtual da Minha Empresa.
│   Responda sempre em português, seja educado e prestativo.
│   Se não souber a resposta, peça para o cliente aguardar
│   que um humano irá atendê-lo."
├── Delay: 2s mín, 5s máx
├── Modo: "Responder a todas"
├── OpenAI API Key: sk-...
└── Clicar em "Criar"

Passo 4: Testar
├── Envie uma mensagem para o número do WhatsApp
├── Aguarde 2-5 segundos (delay configurado)
├── Receba a resposta automática da IA
└── Verifique em Logs de Conversa que a mensagem foi registrada

Passo 5: Ajustar
├── Edite o System Prompt para refinar respostas
├── Adicione palavras-chave se quiser filtrar mensagens
├── Ajuste o delay conforme necessidade
└── As alterações valem a partir da próxima mensagem
```

---

## 9. API Backend

### Swagger (Documentação Interativa)

- **URL:** http://localhost:8000/docs
- Permite testar todos os endpoints diretamente pelo navegador
- Autenticação via botão "Authorize" → inserir a API Key do tenant

### Endpoints Principais

| Grupo | Endpoint | Descrição |
|-------|----------|-----------|
| Tenants | `POST /api/tenants` | Criar tenant |
| | `GET /api/tenants` | Listar tenants |
| | `PUT /api/tenants/{id}` | Atualizar tenant |
| | `DELETE /api/tenants/{id}` | Excluir tenant |
| | `POST /api/tenants/{id}/regenerate-api-key` | Regenerar chave |
| Bot Configs | `POST /api/bot-configs` | Criar configuração |
| | `GET /api/bot-configs` | Listar configurações |
| | `PUT /api/bot-configs/{id}` | Atualizar configuração |
| | `DELETE /api/bot-configs/{id}` | Excluir configuração |
| | `POST /api/bot-configs/{id}/activate` | Ativar configuração |
| Mensagens | `GET /api/messages` | Listar mensagens |
| | `GET /api/messages/stats` | Estatísticas |
| | `GET /api/messages/recent` | Mensagens recentes |
| | `GET /api/messages/conversation/{session_id}` | Histórico de conversa |
| Health | `GET /health` | Status da API |
| Webhook | `POST /api/whatsapp` | Receber mensagens do Bridge |

### Exemplo: Criar Tenant via API

```bash
curl -X POST http://localhost:8000/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -d '{
    "name": "Minha Empresa",
    "phone_number": "+5511999999999"
  }'
```

---

## 10. Painel Admin (Jinja2)

**URL:** http://localhost:8000/admin

Painel alternativo acessível diretamente no backend (sem necessidade do Next.js).

### Páginas

| URL | Funcionalidade |
|-----|---------------|
| `/admin/` | Dashboard com estatísticas gerais |
| `/admin/tenants` | Lista e gerenciamento de tenants |
| `/admin/tenants/new` | Formulário de criação de tenant |
| `/admin/configs` | Lista e gerenciamento de bot configs |
| `/admin/configs/new` | Formulário de criação de config |
| `/admin/logs` | Visualização de logs com filtros |

---

## 11. Referência de URLs

### Desenvolvimento Local

| Serviço | URL |
|---------|-----|
| Admin Panel (Next.js) | http://localhost:3001 |
| Login | http://localhost:3001/login |
| Dashboard | http://localhost:3001/dashboard |
| Tenants | http://localhost:3001/tenants |
| Bot Configs | http://localhost:3001/bot-configs |
| WhatsApp | http://localhost:3001/whatsapp |
| Mensagens | http://localhost:3001/messages |
| Billing | http://localhost:3001/billing |
| Esqueci Senha | http://localhost:3001/forgot-password |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| Admin Jinja2 | http://localhost:8000/admin |
| Bridge Health | http://localhost:3000/api/health |

### Credenciais de Teste

| Campo | Valor |
|-------|-------|
| Email | admin@duzapi.com |
| Senha | Admin@1234 |
