'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const publicDir = path.join(__dirname, '..', 'public');

function sendPage(fileName, res) {
  const filePath = path.join(publicDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`Page file missing: ${fileName}`);
  }

  return res.sendFile(filePath);
}

router.get('/', (req, res) => {
  sendPage('index.html', res);
});

router.get('/studio.html', (req, res) => {
  sendPage('studio.html', res);
});

router.get('/production.html', (req, res) => {
  sendPage('production.html', res);
});

module.exports = router;
