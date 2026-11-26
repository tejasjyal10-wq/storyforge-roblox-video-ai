
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve homepage and frontend assets
app.use(express.static(publicDir));

// Explicit homepage route
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'StoryForge',
    timestamp: new Date().toISOString()
  });
});

// API information
app.get('/api', (req, res) => {
  res.json({
    success: true,
    name: 'StoryForge API',
    version: '1.0.0',
    status: 'running'
  });
});

// Story creation endpoint
app.post('/api/story-director', async (req, res) => {
  try {
    const idea = String(req.body?.idea || '').trim();

    if (!idea) {
      return res.status(400).json({
        success: false,
        error: 'A story idea is required.'
      });
    }

    res.json({
      success: true,
      message: 'Story idea received.',
      idea
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Story creation failed.'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StoryForge running on port ${PORT}`);
  });
}

module.exports = app;
