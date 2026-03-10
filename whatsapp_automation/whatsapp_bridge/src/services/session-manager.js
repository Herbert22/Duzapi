const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs').promises;
const path = require('path');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
const MessageHandler = require('./message-handler');

// ---------------------------------------------------------------------------
// Redis client (lazy init, fail-open on errors)
// ---------------------------------------------------------------------------
let redisClient = null;

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redisClient.on('error', (err) => logger.warn('Redis error', { error: err.message }));
  }
  return redisClient;
}

const REDIS_TENANT_KEY = 'bridge:tenant_mapping';
const REDIS_SESSIONS_KEY = 'bridge:known_sessions';

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.qrCodes = new Map();
    this.tenantMapping = new Map();
    this.messageHandler = new MessageHandler(this);
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize() {
    await fs.mkdir(config.sessionsPath, { recursive: true });

    // Load tenant mapping from Redis (fallback to file)
    await this.loadTenantMapping();

    // Restore previously-active sessions
    await this.restoreSessionsFromRedis();

    logger.info('Session manager initialized', { sessionsPath: config.sessionsPath });
  }

  // --------------------------------------------------------------------------
  // Tenant mapping — persisted in Redis HASH
  // --------------------------------------------------------------------------

  async loadTenantMapping() {
    try {
      const redis = getRedis();
      const mapping = await redis.hgetall(REDIS_TENANT_KEY);
      if (mapping && Object.keys(mapping).length > 0) {
        for (const [sessionId, tenantId] of Object.entries(mapping)) {
          this.tenantMapping.set(sessionId, tenantId);
        }
        logger.info('Tenant mapping loaded from Redis', { count: this.tenantMapping.size });
        return;
      }
    } catch (err) {
      logger.warn('Redis unavailable, falling back to file for tenant mapping', { error: err.message });
    }

    // Fallback: JSON file
    try {
      const data = await fs.readFile(config.tenantMappingPath || './tenant_mapping.json', 'utf-8');
      const mapping = JSON.parse(data);
      for (const [sessionId, tenantId] of Object.entries(mapping)) {
        this.tenantMapping.set(sessionId, tenantId);
      }
      logger.info('Tenant mapping loaded from file', { count: this.tenantMapping.size });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error('Error loading tenant mapping from file', { error: err.message });
      }
    }
  }

  async setTenantMapping(sessionId, tenantId) {
    this.tenantMapping.set(sessionId, tenantId);
    try {
      const redis = getRedis();
      await redis.hset(REDIS_TENANT_KEY, sessionId, tenantId);
    } catch (err) {
      logger.warn('Failed to persist tenant mapping to Redis', { error: err.message });
    }
    logger.info('Tenant mapping updated', { sessionId, tenantId });
  }

  getTenantId(sessionId) {
    return this.tenantMapping.get(sessionId);
  }

  // --------------------------------------------------------------------------
  // Session persistence in Redis
  // --------------------------------------------------------------------------

  async _persistSessionToRedis(sessionId) {
    try {
      const redis = getRedis();
      await redis.sadd(REDIS_SESSIONS_KEY, sessionId);
      await redis.expire(REDIS_SESSIONS_KEY, config.sessionPersistTtl);
    } catch (err) {
      logger.warn('Failed to persist session to Redis', { error: err.message });
    }
  }

  async _removeSessionFromRedis(sessionId) {
    try {
      const redis = getRedis();
      await redis.srem(REDIS_SESSIONS_KEY, sessionId);
    } catch (err) {
      logger.warn('Failed to remove session from Redis', { error: err.message });
    }
  }

  async restoreSessionsFromRedis() {
    // 1. Try Redis first
    let sessionIds = [];
    try {
      const redis = getRedis();
      sessionIds = await redis.smembers(REDIS_SESSIONS_KEY);
    } catch (err) {
      logger.warn('Redis unavailable for session restore', { error: err.message });
    }

    // 2. Also discover sessions from disk (folders in sessionsPath)
    try {
      const entries = await fs.readdir(config.sessionsPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !sessionIds.includes(entry.name)) {
          sessionIds.push(entry.name);
          // Re-register in Redis so future restarts find it
          try {
            const redis = getRedis();
            await redis.sadd(REDIS_SESSIONS_KEY, entry.name);
          } catch (_) { /* ignore */ }
        }
      }
    } catch (err) {
      logger.warn('Could not read sessions directory', { error: err.message });
    }

    if (!sessionIds || sessionIds.length === 0) return;

    logger.info('Restoring sessions', { count: sessionIds.length, ids: sessionIds });

    for (const sessionId of sessionIds) {
      const tokenPath = path.join(config.sessionsPath, sessionId);
      try {
        await fs.access(tokenPath);
        logger.info('Restoring session', { sessionId });
        this.startSession(sessionId, this.tenantMapping.get(sessionId)).catch((err) => {
          logger.warn('Failed to restore session', { sessionId, error: err.message });
        });
      } catch {
        logger.debug('No saved token for session, skipping restore', { sessionId });
        await this._removeSessionFromRedis(sessionId);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Session lifecycle
  // --------------------------------------------------------------------------

  async startSession(sessionId, tenantId) {
    const existing = this.sessions.get(sessionId);
    if (existing && existing.isConnected) {
      return { status: 'already_connected', sessionId };
    }

    if (tenantId) {
      await this.setTenantMapping(sessionId, tenantId);
    }

    logger.info('Starting session', { sessionId, tenantId });

    // Clean stale Chromium lock files from previous container runs
    const sessionFolder = path.join(config.sessionsPath, sessionId);
    for (const lockFile of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      try { await fs.unlink(path.join(sessionFolder, lockFile)); } catch (_) { /* ignore */ }
    }

    return new Promise((resolve, reject) => {
      let qrCodeGenerated = false;

      wppconnect.create({
        session: sessionId,
        folderNameToken: config.sessionsPath,
        headless: config.wppconnect.headless,
        useChrome: config.wppconnect.useChrome,
        debug: config.wppconnect.debug,
        logQR: config.wppconnect.logQR,
        browserPathExecutable: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        browserArgs: config.wppconnect.browserArgs,
        puppeteerOptions: {
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
          args: config.wppconnect.browserArgs,
          timeout: 120000,
          protocolTimeout: 120000,
        },

        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          qrCodeGenerated = true;
          this.qrCodes.set(sessionId, {
            base64: base64Qr,
            ascii: asciiQR,
            attempts,
            urlCode,
            timestamp: new Date().toISOString(),
            // QR expires in 2 minutes
            expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
          });

          logger.info('QR Code generated', { sessionId, attempts });

          if (attempts === 1) {
            resolve({ status: 'qr_code', sessionId, qrCode: base64Qr, attempts });
          }
        },

        statusFind: (statusSession) => {
          logger.info('Session status', { sessionId, status: statusSession });
          if (statusSession === 'inChat' || statusSession === 'isLogged') {
            this.qrCodes.delete(sessionId);
          }
        }
      })
      .then(async (client) => {
        this.sessions.set(sessionId, {
          client,
          isConnected: true,
          connectedAt: new Date().toISOString()
        });

        // Persist to Redis so it survives restart
        await this._persistSessionToRedis(sessionId);

        // Incoming message listener
        client.onMessage(async (message) => {
          await this.messageHandler.handleIncomingMessage(sessionId, message);
        });

        // State change listener — auto-reconnect on disconnect
        client.onStateChange(async (state) => {
          logger.info('Session state changed', { sessionId, state });
          const session = this.sessions.get(sessionId);
          if (session) {
            session.state = state;
            session.isConnected = state === 'CONNECTED';
          }

          if (state === 'CONFLICT' || state === 'UNPAIRED' || state === 'DISCONNECTED') {
            logger.warn('Session disconnected, scheduling reconnect', { sessionId, state });
            setTimeout(() => {
              this.startSession(sessionId, this.tenantMapping.get(sessionId)).catch((err) => {
                logger.error('Auto-reconnect failed', { sessionId, error: err.message });
              });
            }, 30000); // retry after 30s
          }
        });

        logger.info('Session connected successfully', { sessionId });

        if (!qrCodeGenerated) {
          resolve({ status: 'connected', sessionId });
        }
      })
      .catch((error) => {
        logger.error('Error starting session', { sessionId, error: error.message });
        reject(error);
      });
    });
  }

  async stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { status: 'not_found', sessionId };

    try {
      await session.client.close();
      this.sessions.delete(sessionId);
      this.qrCodes.delete(sessionId);
      await this._removeSessionFromRedis(sessionId);
      logger.info('Session stopped', { sessionId });
      return { status: 'stopped', sessionId };
    } catch (error) {
      logger.error('Error stopping session', { sessionId, error: error.message });
      throw error;
    }
  }

  async deleteSession(sessionId) {
    // Stop the session first if running
    const session = this.sessions.get(sessionId);
    if (session) {
      try { await session.client.close(); } catch (_) { /* ignore */ }
      this.sessions.delete(sessionId);
    }
    this.qrCodes.delete(sessionId);
    await this._removeSessionFromRedis(sessionId);

    // Remove session folder from disk
    const sessionFolder = path.join(config.sessionsPath, sessionId);
    try {
      await fs.rm(sessionFolder, { recursive: true, force: true });
      logger.info('Session deleted', { sessionId });
    } catch (err) {
      logger.warn('Could not delete session folder', { sessionId, error: err.message });
    }

    return { status: 'deleted', sessionId };
  }

  // --------------------------------------------------------------------------
  // Status / info
  // --------------------------------------------------------------------------

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    const qrCode = this.qrCodes.get(sessionId);
    const tenantId = this.tenantMapping.get(sessionId);

    if (!session && !qrCode) {
      return { sessionId, status: 'not_found', tenantId };
    }

    // QR code might be expired
    const qrExpired = qrCode && new Date(qrCode.expiresAt) < new Date();

    return {
      sessionId,
      status: session?.isConnected ? 'connected' : (qrCode && !qrExpired ? 'waiting_qr_scan' : 'disconnected'),
      isConnected: session?.isConnected || false,
      connectedAt: session?.connectedAt,
      state: session?.state,
      qrCode: qrCode && !qrExpired ? qrCode.base64 : null,
      qrAttempts: qrCode?.attempts,
      qrExpired: qrExpired || false,
      tenantId
    };
  }

  getAllSessions() {
    const sessions = [];

    for (const [sessionId, session] of this.sessions) {
      sessions.push({
        sessionId,
        status: session.isConnected ? 'connected' : 'disconnected',
        isConnected: session.isConnected,
        connectedAt: session.connectedAt,
        state: session.state,
        tenantId: this.tenantMapping.get(sessionId)
      });
    }

    for (const [sessionId, qrCode] of this.qrCodes) {
      if (!this.sessions.has(sessionId)) {
        const qrExpired = new Date(qrCode.expiresAt) < new Date();
        sessions.push({
          sessionId,
          status: qrExpired ? 'disconnected' : 'waiting_qr_scan',
          isConnected: false,
          qrAttempts: qrCode.attempts,
          qrExpired,
          tenantId: this.tenantMapping.get(sessionId)
        });
      }
    }

    return sessions;
  }

  async sendMessage(sessionId, to, message) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} is not connected`);
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const result = await session.client.sendText(chatId, message);
    logger.info('Message sent', { sessionId, to: chatId, messageId: result.id });
    return { success: true, messageId: result.id, to: chatId, timestamp: new Date().toISOString() };
  }

  async sendAudioBase64(sessionId, to, base64Audio, mimeType = 'audio/ogg') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} is not connected`);
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    // Send as PTT (Push-to-Talk / voice message) using base64
    const result = await session.client.sendPttFromBase64(
      chatId,
      `data:${mimeType};base64,${base64Audio}`,
      'audio.ogg',
    );
    logger.info('Audio sent', { sessionId, to: chatId, messageId: result.id });
    return { success: true, messageId: result.id, to: chatId, timestamp: new Date().toISOString() };
  }

  async sendImageBase64(sessionId, to, base64Image, mimeType = 'image/jpeg', caption = '') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} is not connected`);
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const ext = mimeType.split('/')[1] || 'jpg';
    const result = await session.client.sendImageFromBase64(
      chatId,
      `data:${mimeType};base64,${base64Image}`,
      `image.${ext}`,
      caption,
    );
    logger.info('Image sent', { sessionId, to: chatId, messageId: result.id });
    return { success: true, messageId: result.id, to: chatId, timestamp: new Date().toISOString() };
  }

  async sendVideoBase64(sessionId, to, base64Video, mimeType = 'video/mp4', caption = '') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} is not connected`);
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const ext = mimeType.split('/')[1] || 'mp4';
    const result = await session.client.sendFileFromBase64(
      chatId,
      `data:${mimeType};base64,${base64Video}`,
      `video.${ext}`,
      caption,
    );
    logger.info('Video sent', { sessionId, to: chatId, messageId: result.id });
    return { success: true, messageId: result.id, to: chatId, timestamp: new Date().toISOString() };
  }

  async sendDocumentBase64(sessionId, to, base64Doc, mimeType = 'application/pdf', filename = 'document.pdf', caption = '') {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isConnected) {
      throw new Error(`Session ${sessionId} is not connected`);
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    const result = await session.client.sendFileFromBase64(
      chatId,
      `data:${mimeType};base64,${base64Doc}`,
      filename,
      caption,
    );
    logger.info('Document sent', { sessionId, to: chatId, messageId: result.id });
    return { success: true, messageId: result.id, to: chatId, timestamp: new Date().toISOString() };
  }

  getQRCode(sessionId) {
    return this.qrCodes.get(sessionId);
  }
}

const sessionManager = new SessionManager();
module.exports = sessionManager;
