
'use strict';

const express = require('express');
const router = express.Router();

// API information
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'StoryForge API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      healthDetails: '/api/health/details',
      storyDirector: '/api/story-director'
    }
  });
});

module.exports = router;
