const crypto = require('crypto');
const axios = require('axios');
const axiosRetry = require('axios-retry').default || require('axios-retry');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Axios instance with retry for webhook delivery
// ---------------------------------------------------------------------------
const webhookClient = axios.create({ timeout: 30000 });
axiosRetry(webhookClient, {
  retries: config.webhookRetryMax,
  retryDelay: (retryCount) => retryCount * config.webhookRetryDelayMs,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response && error.response.status >= 500)
});

// ---------------------------------------------------------------------------
// HMAC signature helper
// ---------------------------------------------------------------------------
function signPayload(payloadStr) {
  const hmac = crypto.createHmac('sha256', config.webhookSecret);
  hmac.update(payloadStr);
  return 'sha256=' + hmac.digest('hex');
}

// ---------------------------------------------------------------------------
// Periodic audio cleanup (files older than 24 h)
// ---------------------------------------------------------------------------
const AUDIO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

setInterval(async () => {
  try {
    const audioDir = config.audioDownloadPath;
    let files;
    try {
      files = await fs.readdir(audioDir);
    } catch {
      return; // directory doesn't exist yet
    }
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(audioDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > AUDIO_MAX_AGE_MS) {
          await fs.unlink(filePath);
          logger.debug('Cleaned up old audio file', { file });
        }
      } catch {
        // ignore individual file errors
      }
    }
  } catch (err) {
    logger.warn('Audio cleanup error', { error: err.message });
  }
}, 60 * 60 * 1000); // run every hour

// ---------------------------------------------------------------------------
// MessageHandler
// ---------------------------------------------------------------------------
class MessageHandler {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Handle incoming WhatsApp message
   */
  async handleIncomingMessage(sessionId, message) {
    try {
      // Ignore group messages and status updates
      if (message.isGroupMsg || message.from === 'status@broadcast') {
        return;
      }

      // Ignore messages sent by us
      if (message.fromMe) {
        return;
      }

      // Ignore old messages (sync backlog on reconnect) — older than 60s
      if (message.timestamp) {
        const messageAge = Date.now() - message.timestamp * 1000;
        if (messageAge > 60000) {
          return;
        }
      }

      const tenantId = this.sessionManager.getTenantId(sessionId);
      if (!tenantId) {
        logger.warn('No tenant mapping for session', { sessionId });
        return;
      }

      logger.info('Processing incoming message', {
        sessionId,
        tenantId,
        from: message.from,
        type: message.type,
        messageId: message.id
      });

      let webhookPayload;

      switch (message.type) {
        case 'chat':
          webhookPayload = this.processTextMessage(sessionId, tenantId, message);
          break;

        case 'ptt': // push-to-talk
        case 'audio':
          webhookPayload = await this.processAudioMessage(sessionId, tenantId, message);
          break;

        case 'image':
        case 'video':
        case 'document':
        case 'sticker':
          logger.info('Media message received (not processed)', {
            sessionId,
            type: message.type,
            from: message.from
          });
          return;

        default:
          logger.debug('Unsupported message type', { sessionId, type: message.type });
          return;
      }

      if (webhookPayload) {
        await this.sendWebhook(webhookPayload);
      }

    } catch (error) {
      logger.error('Error handling incoming message', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Process text message
   */
  processTextMessage(sessionId, tenantId, message) {
    return {
      tenant_id: tenantId,
      session_id: sessionId,
      sender_phone: this.extractPhoneNumber(message.from),
      message_type: 'text',
      content: message.body,
      audio_url: null,
      message_id: message.id,
      timestamp: new Date(message.timestamp * 1000).toISOString()
    };
  }

  /**
   * Process audio message
   */
  async processAudioMessage(sessionId, tenantId, message) {
    const senderPhone = this.extractPhoneNumber(message.from);

    try {
      const session = this.sessionManager.sessions.get(sessionId);
      if (!session || !session.client) {
        throw new Error('Session not connected');
      }

      // Check audio size before downloading
      if (message.size && message.size > config.maxAudioSizeBytes) {
        logger.warn('Audio file too large, skipping', {
          sessionId,
          size: message.size,
          maxBytes: config.maxAudioSizeBytes
        });
        return {
          tenant_id: tenantId,
          session_id: sessionId,
          sender_phone: senderPhone,
          message_type: 'audio',
          content: null,
          audio_url: null,
          message_id: message.id,
          timestamp: new Date(message.timestamp * 1000).toISOString(),
          error: 'Audio file exceeds size limit'
        };
      }

      // Decrypt with timeout
      const DECRYPT_TIMEOUT_MS = 30000;
      const mediaData = await Promise.race([
        session.client.decryptFile(message),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('decryptFile timeout')), DECRYPT_TIMEOUT_MS)
        )
      ]);

      const filename = `${uuidv4()}.ogg`;
      const audioDir = config.audioDownloadPath;
      const filePath = path.join(audioDir, filename);

      await fs.mkdir(audioDir, { recursive: true });
      await fs.writeFile(filePath, mediaData);

      const audioUrl = `${config.audioBaseUrl}/${filename}`;
      logger.info('Audio file saved', { sessionId, filename, audioUrl });

      return {
        tenant_id: tenantId,
        session_id: sessionId,
        sender_phone: senderPhone,
        message_type: 'audio',
        content: null,
        audio_url: audioUrl,
        message_id: message.id,
        timestamp: new Date(message.timestamp * 1000).toISOString()
      };

    } catch (error) {
      logger.error('Error processing audio message', { sessionId, error: error.message });
      return {
        tenant_id: tenantId,
        session_id: sessionId,
        sender_phone: senderPhone,
        message_type: 'audio',
        content: null,
        audio_url: null,
        message_id: message.id,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        error: 'Failed to download audio'
      };
    }
  }

  /**
   * Extract phone number from WhatsApp ID
   */
  extractPhoneNumber(whatsappId) {
    return whatsappId.replace('@c.us', '').replace('@s.whatsapp.net', '');
  }

  /**
   * Send webhook to backend with HMAC signature and retry
   */
  async sendWebhook(payload) {
    const payloadStr = JSON.stringify(payload);
    const signature = signPayload(payloadStr);

    try {
      logger.info('Sending webhook to backend', {
        url: config.backendWebhookUrl,
        tenantId: payload.tenant_id,
        messageType: payload.message_type
      });

      const response = await webhookClient.post(
        config.backendWebhookUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Bridge-Signature': signature
          }
        }
      );

      logger.info('Webhook sent successfully', {
        status: response.status,
        tenantId: payload.tenant_id
      });

      return response.data;

    } catch (error) {
      logger.error('Error sending webhook (all retries exhausted)', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        tenantId: payload.tenant_id
      });
      // Do not throw — we don't want to crash the message handler
    }
  }
}

module.exports = MessageHandler;
