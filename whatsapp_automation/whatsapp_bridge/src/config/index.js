require('dotenv').config();

const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Backend webhook URL
  backendWebhookUrl: process.env.BACKEND_WEBHOOK_URL || 'http://backend:8000/api/v1/webhooks/whatsapp',

  // Shared secrets with the backend
  bridgeAuthToken: process.env.BRIDGE_AUTH_TOKEN || 'dev-bridge-token-change-in-production',
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-webhook-secret-change-in-production',

  // Redis URL (for session persistence and tenant mapping)
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379/0',

  // Session storage path
  sessionsPath: process.env.SESSIONS_PATH || './sessions',

  // WPPConnect configuration
  wppconnect: {
    headless: process.env.WPP_HEADLESS !== 'false',
    useChrome: process.env.WPP_USE_CHROME === 'true',
    debug: process.env.WPP_DEBUG === 'true',
    logQR: process.env.WPP_LOG_QR !== 'false',
    browserArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },

  // Audio download configuration
  audioDownloadPath: process.env.AUDIO_DOWNLOAD_PATH || './downloads/audio',
  audioBaseUrl: process.env.AUDIO_BASE_URL || 'http://whatsapp_bridge:3000/audio',

  // Maximum audio file size in bytes (default 5 MB)
  maxAudioSizeBytes: parseInt(process.env.MAX_AUDIO_SIZE_BYTES || String(5 * 1024 * 1024), 10),

  // Webhook retry configuration
  webhookRetryMax: parseInt(process.env.WEBHOOK_RETRY_MAX || '3', 10),
  webhookRetryDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '2000', 10),

  // Session persistence TTL in seconds (24 hours)
  sessionPersistTtl: parseInt(process.env.SESSION_PERSIST_TTL || '86400', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

module.exports = config;
