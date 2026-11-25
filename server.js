const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '2mb' }));

const { createLearningRouter } = require('./storyforge-learning');
app.use('/api/learning', createLearningRouter());

app.use(express.static(path.join(__dirname, 'public')));

// Allow browser requests to the backend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// SERVE THE ACTUAL STORYFORGE WEBSITE
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/$/, '');
const MODEL = process.env.AGNES_VIDEO_MODEL || 'agnes-video-2.5-flash';
const KEY = process.env.AGNES_API_KEY;

const jobs = new Map();
const generationRequests = new Map();

const GENERATION_LIMIT = 3;
const GENERATION_WINDOW_MS = 60 * 60 * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

function providerReady() {
  return Boolean(KEY && KEY.trim());
}

async function apiFetch(url, opts = {}) {
  const response = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message = data?.message || data?.error || raw.slice(0, 300);
    const error = new Error(`Provider ${response.status}: ${message}`);
    error.status = response.status;
    error.providerData = data;
    throw error;
  }

  return data;
}

// Queue-full retry handler
async function submitWithQueueRetries(job) {
  const robloxStyle =
    'Roblox-inspired 3D game animation, blocky toy-like avatar proportions, consistent visual design, clean render. ' +
    job.prompt;

  let retries = 0;

  while (true) {
    job.status = retries ? 'retrying' : 'submitting';
    job.retryCount = retries;
    job.updatedAt = Date.now();

    try {
      const data = await apiFetch(`${BASE}/v1/videos`, {
        method: 'POST',
        body: JSON.stringify({
          model: MODEL,
          prompt: robloxStyle,
          mode: 'text',
          seconds: String(job.seconds),
          size: '720P',
          aspect_ratio: job.aspectRatio
        })
      });

      const videoId = data.video_id || data.id;

      if (!videoId) {
        throw new Error('Provider response did not include video_id.');
      }

      job.videoId = videoId;
      job.status = 'processing';
      job.providerData = data;
      job.updatedAt = Date.now();
      return;

    } catch (error) {
      const isQueueFull =
        error.status === 503 &&
        /queue\s+is\s+full/i.test(error.message);

      if (!isQueueFull || retries >= RETRY_DELAYS_MS.length) {
        job.status = 'failed';
        job.error = isQueueFull
          ? 'The video provider queue is still full after automatic retries. Please try again later.'
          : error.message;
        job.providerData = error.providerData || null;
        job.updatedAt = Date.now();
        return;
      }

      const delay = RETRY_DELAYS_MS[retries];
      retries++;

      job.status = 'retry_wait';
      job.retryCount = retries;
      job.retryAfterMs = delay;
      job.updatedAt = Date.now();

      await sleep(delay);
    }
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    providerConfigured: providerReady(),
    model: MODEL,
    mode: providerReady() ? 'provider' : 'setup-required'
  });
});

// Create video job
app.post('/api/generate', (req, res) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const recent = (generationRequests.get(ip) || [])
    .filter(timestamp => now - timestamp < GENERATION_WINDOW_MS);

  if (recent.length >= GENERATION_LIMIT) {
    generationRequests.set(ip, recent);
    return res.status(429).json({
      error: 'Generation limit reached for this hour. Please wait before trying again.'
    });
  }

  if (!providerReady()) {
    return res.status(503).json({
      error: 'Video API is not configured. Add AGNES_API_KEY to the server environment.'
    });
  }

  const prompt = String(req.body?.prompt || '').trim();

  if (!prompt) {
    return res.status(400).json({
      error: 'Please enter a story or scene prompt.'
    });
  }

  const seconds = Math.max(4, Math.min(12, Number(req.body.seconds) || 8));

  const aspectRatio = ['16:9', '9:16', '1:1'].includes(req.body.aspect_ratio)
    ? req.body.aspect_ratio
    : '16:9';

  recent.push(now);
  generationRequests.set(ip, recent);

  const jobId = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const job = {
    jobId,
    model: MODEL,
    prompt,
    seconds,
    aspectRatio,
    status: 'queued',
    retryCount: 0,
    createdAt: now,
    updatedAt: now
  };

  jobs.set(jobId, job);

  // Respond immediately; provider retries run in the background.
  res.json({
    jobId,
    status: 'queued',
    model: MODEL
  });

  submitWithQueueRetries(job).catch(error => {
    job.status = 'failed';
    job.error = error.message || 'Unexpected backend error.';
    job.updatedAt = Date.now();
  });
});

// Job status
app.get('/api/jobs/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found. It may have expired after a server restart.'
    });
  }

  if (
    !job.videoId ||
    ['queued', 'submitting', 'retrying', 'retry_wait', 'failed'].includes(job.status)
  ) {
    return res.json({
      jobId: job.jobId,
      status: job.status,
      error: job.error,
      retryCount: job.retryCount,
      retryAfterMs: job.retryAfterMs,
      model: job.model,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
  }

  if (job.status === 'completed') {
    return res.json(job);
  }

  try {
    const params = new URLSearchParams({
      video_id: job.videoId,
      model_name: job.model
    });

    const data = await apiFetch(`${BASE}/agnesapi?${params}`);
    const status = String(data.status || '').toLowerCase();

    const url =
      data.url ||
      data.video_url ||
      data.output?.url ||
      data.result?.url;

    if (
      ['completed', 'complete', 'success', 'succeeded', 'done'].includes(status) &&
      url
    ) {
      job.status = 'completed';
      job.videoUrl = url;
      job.providerData = data;

    } else if (['failed', 'error', 'cancelled'].includes(status)) {
      job.status = 'failed';
      job.error = data.error || data.message || 'Video generation failed';
      job.providerData = data;

    } else {
      job.status = status || 'processing';
      job.progress = Number(data.progress) || 0;
    }

    job.updatedAt = Date.now();
    res.json(job);

  } catch (error) {
    res.status(502).json({
      error: error.message,
      jobId: job.jobId,
      status: job.status
    });
  }
});

// Start Express server
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StoryForge running on port ${PORT}`);
  });
}

module.exports = { app, jobs };
