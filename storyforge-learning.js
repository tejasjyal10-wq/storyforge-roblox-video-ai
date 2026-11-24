
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createLearningRouter() {
  const router = express.Router();

  const DATA_FILE =
    process.env.STORYFORGE_LEARNING_FILE ||
    path.join(__dirname, 'data', 'storyforge-learning.json');

  // Protect learning endpoints with a server-side access token.
  const ACCESS_TOKEN = process.env.LEARNING_ACCESS_TOKEN || '';

  let data = {
    enabled: true,
    memories: [],
    feedback: []
  };

  // Load saved memory
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      data = {
        enabled: saved.enabled !== false,
        memories: Array.isArray(saved.memories) ? saved.memories : [],
        feedback: Array.isArray(saved.feedback) ? saved.feedback : []
      };
    }
  } catch (error) {
    console.error('Learning memory load error:', error.message);
  }

  function saveData() {
    const dir = path.dirname(DATA_FILE);
    fs.mkdirSync(dir, { recursive: true });

    const tempFile = DATA_FILE + '.tmp';

    fs.writeFileSync(
      tempFile,
      JSON.stringify(data, null, 2),
      'utf8'
    );

    fs.renameSync(tempFile, DATA_FILE);
  }

  // Authenticate protected routes
  router.use((req, res, next) => {
    if (!ACCESS_TOKEN) {
      return res.status(503).json({
        error: 'Learning access is not configured on the server.'
      });
    }

    const provided = req.get('x-learning-token') || '';

    const a = Buffer.from(provided);
    const b = Buffer.from(ACCESS_TOKEN);

    if (a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({
        error: 'Unauthorized.'
      });
    }

    next();
  });

  // Status
  router.get('/status', (req, res) => {
    res.json({
      ok: true,
      enabled: data.enabled,
      memoryCount: data.memories.length,
      feedbackCount: data.feedback.length
    });
  });

  // View memories
  router.get('/memories', (req, res) => {
    res.json({
      enabled: data.enabled,
      memories: data.memories
    });
  });

  // Enable or disable learning
  router.post('/toggle', (req, res) => {
    if (typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled must be true or false.'
      });
    }

    data.enabled = req.body.enabled;
    saveData();

    res.json({
      ok: true,
      enabled: data.enabled
    });
  });

  // Store creative preferences
  router.post('/learn', (req, res) => {
    if (!data.enabled) {
      return res.json({
        ok: true,
        learned: false,
        reason: 'Learning is disabled.'
      });
    }

    const text = String(req.body.text || '').trim().slice(0, 1500);

    if (!text) {
      return res.status(400).json({
        error: 'Preference text is required.'
      });
    }

    const categories = {
      camera: /camera|angle|zoom|pan|shot|view/i,
      animation: /animation|movement|motion|walk|run|action/i,
      characters: /character|avatar|face|appearance|outfit/i,
      story: /story|plot|dialogue|scene|pacing/i,
      visuals: /visual|lighting|color|environment|style/i,
      audio: /audio|sound|music|voice/i
    };

    const category =
      Object.keys(categories).find(key => categories[key].test(text))
      || 'general';

    const existing = data.memories.find(
      item => item.text.toLowerCase() === text.toLowerCase()
    );

    if (existing) {
      existing.reinforcements = (existing.reinforcements || 1) + 1;
      existing.updatedAt = new Date().toISOString();
    } else {
      data.memories.push({
        id: crypto.randomUUID(),
        category,
        text,
        reinforcements: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    saveData();

    res.json({
      ok: true,
      learned: true,
      category,
      memoryCount: data.memories.length
    });
  });

  // Save video feedback
  router.post('/feedback', (req, res) => {
    const allowed = [
      'excellent',
      'good',
      'needs_improvement'
    ];

    const rating = req.body.rating;

    if (!allowed.includes(rating)) {
      return res.status(400).json({
        error: 'Invalid feedback rating.'
      });
    }

    const notes = String(req.body.notes || '').trim().slice(0, 1500);

    const entry = {
      id: crypto.randomUUID(),
      rating,
      notes,
      createdAt: new Date().toISOString()
    };

    data.feedback.push(entry);

    // Keep the most recent 200 feedback entries.
    if (data.feedback.length > 200) {
      data.feedback = data.feedback.slice(-200);
    }

    saveData();

    res.json({
      ok: true,
      feedbackSaved: true
    });
  });

  // Get learning context for future generation integration
  router.get('/context', (req, res) => {
    if (!data.enabled) {
      return res.json({
        enabled: false,
        context: ''
      });
    }

    const memories = data.memories.slice(-30);

    const context = memories.length
      ? memories.map(item =>
          '- ' + item.category + ': ' + item.text
        ).join('\n')
      : '';

    res.json({
      enabled: true,
      memories,
      context
    });
  });

  // Delete a specific memory
  router.delete('/memories/:id', (req, res) => {
    const before = data.memories.length;

    data.memories = data.memories.filter(
      item => item.id !== req.params.id
    );

    saveData();

    res.json({
      ok: true,
      deleted: data.memories.length !== before
    });
  });

  // Clear all memories
  router.delete('/memories', (req, res) => {
    data.memories = [];
    saveData();

    res.json({
      ok: true,
      memoriesCleared: true
    });
  });

  // Clear feedback history
  router.delete('/history', (req, res) => {
    data.feedback = [];
    saveData();

    res.json({
      ok: true,
      feedbackCleared: true
    });
  });

  return router;
}

module.exports = { createLearningRouter };
