'use strict';

const express = require('express');
const router = express.Router();

// Receive a story idea
router.post('/', async (req, res) => {
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
      status: 'received',
      message: 'Story idea received successfully.',
      story: {
        idea,
        receivedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Story request failed.'
    });
  }
});

module.exports = router;
