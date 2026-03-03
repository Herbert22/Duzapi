# WhatsApp Bridge

Serviço bridge Node.js utilizando WPPConnect para integração multi-tenant com WhatsApp.

## 📋 Visão Geral

O WhatsApp Bridge é responsável por:
- Gerenciar múltiplas sessões WhatsApp (uma por tenant)
- Receber mensagens do WhatsApp e encaminhar para o backend via webhook
- Enviar mensagens de resposta do backend para o WhatsApp
- Download e armazenamento de mensagens de áudio

## 🏗️ Arquitetura

```
whatsapp_bridge/
├── src/
│   ├── index.js              # Entry point
│   ├── config/
│   │   └── index.js          # Configurações
│   ├── services/
│   │   ├── session-manager.js  # Gerenciamento de sessões
│   │   └── message-handler.js  # Handler de mensagens
│   ├── routes/
│   │   └── api.js            # Rotas REST
│   └── utils/
│       └── logger.js         # Winston logger
├── Dockerfile
├── package.json
└── .env.example
```

## 🚀 Endpoints da API

### Gerenciamento de Sessões

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/sessions` | Lista todas as sessões |
| POST | `/api/sessions/:sessionId/start` | Inicia uma nova sessão |
| POST | `/api/sessions/:sessionId/stop` | Para uma sessão |
| GET | `/api/sessions/:sessionId/status` | Status da sessão |
| GET | `/api/sessions/:sessionId/qrcode` | Obtém QR Code |
| POST | `/api/sessions/:sessionId/tenant` | Mapeia sessão para tenant |

### Envio de Mensagens

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/send-message` | Envia mensagem (usado pelo backend) |

### Health Check

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Verifica saúde do serviço |

## 📡 Exemplos de Uso

### Iniciar uma Sessão

```bash
curl -X POST http://localhost:3000/api/sessions/tenant-abc/start \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Resposta:**
```json
{
  "success": true,
  "status": "qr_code",
  "sessionId": "tenant-abc",
  "qrCode": "data:image/png;base64,...",
  "attempts": 1
}
```

### Verificar Status da Sessão

```bash
curl http://localhost:3000/api/sessions/tenant-abc/status
```

**Resposta:**
```json
{
  "success": true,
  "sessionId": "tenant-abc",
  "status": "connected",
  "isConnected": true,
  "connectedAt": "2024-01-15T10:30:00.000Z",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Enviar Mensagem (Backend → WhatsApp)

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "tenant-abc",
    "to": "5511999999999",
    "message": "Olá! Como posso ajudar?"
  }'
```

## 🔄 Fluxo de Mensagens

### Mensagem Recebida (WhatsApp → Backend)

1. Usuário envia mensagem no WhatsApp
2. WPPConnect captura a mensagem
3. `message-handler.js` processa a mensagem
4. Se for áudio, baixa o arquivo
5. Envia webhook para o backend:

```json
POST http://backend:8000/api/v1/webhooks/whatsapp
{
  "tenant_id": "uuid",
  "session_id": "string",
  "sender_phone": "5511999999999",
  "message_type": "text|audio",
  "content": "texto da mensagem",
  "audio_url": "http://whatsapp_bridge:3000/audio/uuid.ogg",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Resposta Enviada (Backend → WhatsApp)

1. Backend processa a mensagem e gera resposta
2. Backend envia para o bridge:

```json
POST http://whatsapp_bridge:3000/api/send-message
{
  "session_id": "string",
  "to": "5511999999999",
  "message": "Resposta do bot"
}
```

3. Bridge envia mensagem via WPPConnect

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente (development/production) | `development` |
| `BACKEND_WEBHOOK_URL` | URL do webhook do backend | `http://backend:8000/api/v1/webhooks/whatsapp` |
| `SESSIONS_PATH` | Pasta para dados das sessões | `./sessions` |
| `TENANT_MAPPING_PATH` | Arquivo de mapeamento tenant/sessão | `./tenant_mapping.json` |
| `AUDIO_DOWNLOAD_PATH` | Pasta para áudios baixados | `./downloads/audio` |
| `AUDIO_BASE_URL` | URL base para servir áudios | `http://whatsapp_bridge:3000/audio` |
| `WPP_HEADLESS` | Executar navegador headless | `true` |
| `WPP_DEBUG` | Modo debug do WPPConnect | `false` |
| `LOG_LEVEL` | Nível de log (debug/info/warn/error) | `info` |

## 🐳 Docker

### Build Local

```bash
cd whatsapp_bridge
docker build -t whatsapp-bridge .
```

### Executar com Docker Compose

```bash
# Da raiz do projeto
docker-compose up whatsapp_bridge
```

### Volumes

- `whatsapp_sessions`: Dados persistentes das sessões WhatsApp
- `whatsapp_downloads`: Arquivos de áudio baixados

## 🔧 Desenvolvimento Local

```bash
# Instalar dependências
cd whatsapp_bridge
npm install

# Criar arquivo .env
cp .env.example .env

# Executar em modo desenvolvimento
npm run dev
```

## 📝 Logs

Os logs são salvos em:
- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros

Formato:
```
2024-01-15 10:30:00 [INFO]: Session connected successfully { sessionId: 'tenant-abc' }
```

## ⚠️ Considerações

1. **Sessões persistentes**: As sessões são salvas em disco, permitindo reconexão automática após restart.

2. **Multi-tenant**: Cada tenant deve ter sua própria sessão com sessionId único.

3. **QR Code**: Na primeira conexão ou após logout, um QR code será gerado para autenticação.

4. **Rate Limiting**: O WhatsApp pode bloquear contas com comportamento suspeito. Implemente delays entre mensagens.

5. **Segurança**: Este serviço deve rodar em rede interna, não exposto publicamente.

## 🛠️ Troubleshooting

### Sessão não conecta
- Verifique se o Chrome/Chromium está instalado
- Verifique os logs em `logs/error.log`
- Tente deletar a pasta `sessions/{sessionId}` e reconectar

### QR Code não aparece
- Verifique se `WPP_LOG_QR=true`
- Acesse `/api/sessions/{sessionId}/qrcode`

### Mensagens não chegam no backend
- Verifique se o `BACKEND_WEBHOOK_URL` está correto
- Verifique conectividade de rede entre containers
- Confira os logs do backend para erros de validação
