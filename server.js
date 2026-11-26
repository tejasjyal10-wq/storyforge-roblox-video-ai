'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createStoryDirectorIntegration } = require('./core/story-director-integration');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const storyDirectorIntegration = createStoryDirectorIntegration();


// --------------------------------------------------
// Application configuration
// --------------------------------------------------

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Serve homepage files and artwork from /public.
app.use(express.static(path.join(__dirname, 'public')));


// --------------------------------------------------
// Request tracking
// --------------------------------------------------

app.use((req, res, next) => {
  req.requestStartedAt = Date.now();
  res.setHeader('X-StoryForge', 'API');
  next();
});


// --------------------------------------------------
// Homepage
// --------------------------------------------------

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
      apiInfo: '/api',
      storyDirector: 'POST /api/story-director',
      job: 'GET /api/jobs/:id'
    }
  });
});


// --------------------------------------------------
// Story Director
// --------------------------------------------------

app.post('/api/story-director', async (req, res, next) => {
  try {
    const idea = req.body && req.body.idea;
    const job = await storyDirectorIntegration.run(idea);
    res.status(201).json({
      ok: job.status === 'completed',
      jobId: job.jobId,
      status: job.status,
      output: job.outputs && job.outputs.storyDirector || null,
      job
    });
  } catch (error) {
    next(error);
  }
});


// --------------------------------------------------
// Job status
// --------------------------------------------------

app.get('/api/jobs/:id', (req, res) => {
  const job = storyDirectorIntegration.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ ok: false, error: 'Job not found.' });
  }
  res.json({ ok: true, job });
});


// --------------------------------------------------
// 404 handler
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint not found.', path: req.path });
});


// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[StoryForge Error]', error.message);
  res.status(error.status || 500).json({
    ok: false,
    error: NODE_ENV === 'production' ? 'An internal server error occurred.' : error.message
  });
});


// --------------------------------------------------
// Server startup
// --------------------------------------------------

const server = app.listen(PORT, () => {
  console.log('------------------------------------');
  console.log('StoryForge Backend + Homepage');
  console.log('Status: ONLINE');
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log('Homepage: /');
  console.log('Health: /api/health');
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
  setTimeout(() => process.exit(1), 10000).unref();
}


process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));


module.exports = app;
