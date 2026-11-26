
'use strict';

const express = require('express');
const path = require('path');

const router = express.Router();

const publicDir = path.join(__dirname, '..', 'public');

// Homepage
router.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Studio
router.get('/studio.html', (req, res) => {
  res.sendFile(path.join(publicDir, 'studio.html'));
});

// Production
router.get('/production.html', (req, res) => {
  res.sendFile(path.join(publicDir, 'production.html'));
});

module.exports = router;
