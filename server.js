
'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// --------------------------------------------------
// Application configuration
// --------------------------------------------------

app.disable('x-powered-by');

app.use(cors());

app.use(express.json({
  limit: '2mb'
}));

app.use(express.urlencoded({
  extended: false,
  limit: '2mb'
}));

// --------------------------------------------------
// Request tracking
// --------------------------------------------------

app.use((req, res, next) => {
  req.requestStartedAt = Date.now();

  res.setHeader('X-StoryForge', 'API');

  next();
});

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    name: 'StoryForge',
    service: 'backend',
    status: 'online',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// --------------------------------------------------
// API information
// --------------------------------------------------

app.get('/api', (req, res) => {
  res.status(200).json({
    ok: true,
    name: 'StoryForge API',
    version: '1.0.0',
    status: 'online',
    message: 'StoryForge backend is running.',
    endpoints: {
      health: '/api/health',
      apiInfo: '/api'
    }
  });
});

// --------------------------------------------------
// 404 handler
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found.',
    path: req.path
  });
});

// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error('[StoryForge Error]', error.message);

  res.status(error.status || 500).json({
    ok: false,
    error: NODE_ENV === 'production'
      ? 'An internal server error occurred.'
      : error.message
  });
});

// --------------------------------------------------
// Server startup
// --------------------------------------------------

const server = app.listen(PORT, () => {
  console.log('------------------------------------');
  console.log('StoryForge Backend');
  console.log(`Status: ONLINE`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Health: /api/health`);
  console.log('------------------------------------');
});

// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

function shutdown(signal) {
  console.log(`[StoryForge] ${signal} received. Shutting down...`);

  server.close(() => {
    console.log('[StoryForge] Server stopped.');
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
