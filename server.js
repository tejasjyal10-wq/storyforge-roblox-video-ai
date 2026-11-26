'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const publicDir = path.join(__dirname, 'public');
const fs = require('fs');

console.log('SERVER DIRECTORY:', __dirname);
console.log('PUBLIC DIRECTORY:', publicDir);
console.log('PUBLIC FILES:', fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : 'PUBLIC FOLDER MISSING');
console.log('PRODUCTION FILE EXISTS:', fs.existsSync(path.join(publicDir, 'production.html')));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend files
app.use(express.static(publicDir));

// Import routers
const pagesRouter = require('./routes/pages');
const healthRouter = require('./routes/health');
const apiRouter = require('./routes/api');
const storyRouter = require('./routes/story');

// Connect routers
app.use('/', pagesRouter);
app.use('/api', healthRouter);
app.use('/api', apiRouter);
app.use('/api/story-director', storyRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StoryForge running on port ${PORT}`);
  });
}

module.exports = app;
