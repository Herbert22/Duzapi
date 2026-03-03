const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');

const config = require('./config');
const logger = require('./utils/logger');
const apiRoutes = require('./routes/api');
const sessionManager = require('./services/session-manager');

const app = express();

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS — restrict to backend origin in production
// ---------------------------------------------------------------------------
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*'
}));

// ---------------------------------------------------------------------------
// Body parsing with request size limit
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ---------------------------------------------------------------------------
// Request logging middleware
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// ---------------------------------------------------------------------------
// API routes (audio is now served via /api/audio/:filename — authenticated)
// ---------------------------------------------------------------------------
app.use('/api', apiRoutes);

// ---------------------------------------------------------------------------
// Root endpoint
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp Bridge',
    version: '1.0.0',
    description: 'WhatsApp Bridge service using WPPConnect',
    endpoints: {
      sessions: '/api/sessions',
      health: '/api/health',
      sendMessage: '/api/send-message'
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    const sessions = sessionManager.getAllSessions();
    for (const session of sessions) {
      try {
        await sessionManager.stopSession(session.sessionId);
      } catch (error) {
        logger.error('Error stopping session during shutdown', {
          sessionId: session.sessionId,
          error: error.message
        });
      }
    }
    logger.info('All sessions stopped');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const startServer = async () => {
  try {
    await sessionManager.initialize();

    app.listen(config.port, () => {
      logger.info('WhatsApp Bridge server started', {
        port: config.port,
        environment: config.nodeEnv
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
