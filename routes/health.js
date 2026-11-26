
'use strict';

const express = require('express');
const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    service: 'StoryForge',
    timestamp: new Date().toISOString()
  });
});

// Detailed server status
router.get('/health/details', (req, res) => {
  res.json({
    success: true,
    service: 'StoryForge',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
