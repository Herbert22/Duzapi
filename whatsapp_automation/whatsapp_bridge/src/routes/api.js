const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const sessionManager = require('../services/session-manager');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Auth middleware — Bearer token check
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  if (token !== config.bridgeAuthToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' }
});

const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many send-message requests' }
});

router.use(globalLimiter);

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ---------------------------------------------------------------------------
// GET /api/health  (public — no auth required)
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  const sessions = sessionManager.getAllSessions();
  const connected = sessions.filter(s => s.isConnected).length;
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    sessions: { total: sessions.length, connected }
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions  (requires auth)
// ---------------------------------------------------------------------------
router.get('/sessions', requireAuth, (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json({ success: true, count: sessions.length, sessions });
  } catch (error) {
    logger.error('Error listing sessions', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list sessions' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionId/start  (requires auth)
// ---------------------------------------------------------------------------
router.post(
  '/sessions/:sessionId/start',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  body('tenant_id').optional().isUUID(),
  handleValidationErrors,
  async (req, res) => {
    const { sessionId } = req.params;
    const { tenant_id } = req.body;
    try {
      logger.info('Starting session', { sessionId, tenantId: tenant_id });
      const result = await sessionManager.startSession(sessionId, tenant_id);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error starting session', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionId/stop  (requires auth)
// ---------------------------------------------------------------------------
router.post(
  '/sessions/:sessionId/stop',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    const { sessionId } = req.params;
    try {
      const result = await sessionManager.stopSession(sessionId);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error stopping session', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/sessions/:sessionId  (requires auth)
// ---------------------------------------------------------------------------
router.delete(
  '/sessions/:sessionId',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    const { sessionId } = req.params;
    try {
      const result = await sessionManager.deleteSession(sessionId);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error deleting session', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionId/status  (requires auth)
// ---------------------------------------------------------------------------
router.get(
  '/sessions/:sessionId/status',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  handleValidationErrors,
  (req, res) => {
    const { sessionId } = req.params;
    try {
      res.json({ success: true, ...sessionManager.getSessionStatus(sessionId) });
    } catch (error) {
      logger.error('Error getting session status', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionId/qrcode  (requires auth)
// ---------------------------------------------------------------------------
router.get(
  '/sessions/:sessionId/qrcode',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  handleValidationErrors,
  (req, res) => {
    const { sessionId } = req.params;
    try {
      const qrCode = sessionManager.getQRCode(sessionId);
      if (!qrCode) {
        return res.status(404).json({
          success: false,
          error: 'QR code not available. Session might already be connected.'
        });
      }
      const expired = new Date(qrCode.expiresAt) < new Date();
      res.json({
        success: true,
        sessionId,
        qrCode: qrCode.base64,
        attempts: qrCode.attempts,
        timestamp: qrCode.timestamp,
        expiresAt: qrCode.expiresAt,
        expired
      });
    } catch (error) {
      logger.error('Error getting QR code', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/sessions/:sessionId/tenant  (requires auth)
// ---------------------------------------------------------------------------
router.post(
  '/sessions/:sessionId/tenant',
  requireAuth,
  param('sessionId').isString().trim().notEmpty(),
  body('tenant_id').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    const { sessionId } = req.params;
    const { tenant_id } = req.body;
    try {
      await sessionManager.setTenantMapping(sessionId, tenant_id);
      res.json({ success: true, sessionId, tenant_id });
    } catch (error) {
      logger.error('Error setting tenant mapping', { sessionId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/send-message  (requires auth + tighter rate limit)
// ---------------------------------------------------------------------------
router.post(
  '/send-message',
  requireAuth,
  sendMessageLimiter,
  body('session_id').isString().trim().notEmpty(),
  body('to').isString().trim().notEmpty(),
  body('message').isString().trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    const { session_id, to, message } = req.body;
    try {
      logger.info('Send message request', { sessionId: session_id, to });
      const result = await sessionManager.sendMessage(session_id, to, message);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error sending message', { sessionId: session_id, to, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/:sessionId/send-message  (WPPConnect URL format, requires auth)
// Called by the Python backend as: /api/{session}/send-message
// ---------------------------------------------------------------------------
router.post(
  '/:sessionId/send-message',
  requireAuth,
  sendMessageLimiter,
  param('sessionId').isString().trim().notEmpty(),
  body('phone').isString().trim().notEmpty(),
  body('message').isString().trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    const { sessionId } = req.params;
    const { phone, message } = req.body;
    try {
      logger.info('Send message request (session URL)', { sessionId, to: phone });
      const result = await sessionManager.sendMessage(sessionId, phone, message);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error sending message', { sessionId, to: phone, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/audio/:filename  (protected — requires auth)
// Replaces unauthenticated express.static for audio files
// ---------------------------------------------------------------------------
router.get('/audio/:filename', requireAuth, async (req, res) => {
  const { filename } = req.params;
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  const filePath = require('path').join(config.audioDownloadPath, filename);
  try {
    await require('fs').promises.access(filePath);
    res.sendFile(require('path').resolve(filePath));
  } catch {
    res.status(404).json({ success: false, error: 'Audio file not found' });
  }
});

module.exports = router;
