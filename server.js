
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '2mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const { createStoryDirectorRouter } = require('./agents/story-director/storyforge-story-director');
// Learning API
const { createLearningRouter } = require('./storyforge-learning');
app.use('/api/learning', createLearningRouter());
app.use('/api/agents/story-director', createStoryDirectorRouter());

// Static website
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Agnes configuration
const BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/$/, '');
const MODEL = process.env.AGNES_VIDEO_MODEL || 'agnes-video-2.5-flash';
const KEY = process.env.AGNES_API_KEY;

// Job storage
const jobs = new Map();
const generationRequests = new Map();

// Configurable quota
const GENERATION_LIMIT = Math.max(
  1,
  Number(process.env.GENERATION_LIMIT) || 3
);

const GENERATION_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.GENERATION_WINDOW_MS) || 60 * 60 * 1000
);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

function providerReady() {
  return Boolean(KEY && KEY.trim());
}

// Quota entries:
// { id, timestamp, status: 'pending' | 'accepted' }
//
// Pending requests reserve slots to prevent simultaneous requests
// from bypassing the hourly limit.

function getQuotaEntries(ip, now = Date.now()) {
  const entries = (generationRequests.get(ip) || [])
    .filter(entry => now - entry.timestamp < GENERATION_WINDOW_MS);

  generationRequests.set(ip, entries);
  return entries;
}

function reserveQuota(ip, jobId) {
  const now = Date.now();
  const entries = getQuotaEntries(ip, now);

  if (entries.length >= GENERATION_LIMIT) {
    return null;
  }

  const reservation = {
    id: jobId,
    timestamp: now,
    status: 'pending'
  };

  entries.push(reservation);
  generationRequests.set(ip, entries);

  return reservation;
}

function markQuotaAccepted(ip, reservation) {
  const entries = getQuotaEntries(ip);

  const entry = entries.find(item => item.id === reservation.id);

  if (entry) {
    entry.status = 'accepted';
    entry.timestamp = Date.now();
  }
}

function releaseQuota(ip, reservation) {
  const entries = getQuotaEntries(ip);

  const updated = entries.filter(item => item.id !== reservation.id);
  generationRequests.set(ip, updated);
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

// Submit video with automatic queue-full retries
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

      // Provider accepted the job — quota is now consumed.
      job.videoId = videoId;
      job.status = 'processing';
      job.providerData = data;
      job.updatedAt = Date.now();

      markQuotaAccepted(job.ip, job.reservation);
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

        // Provider did not accept the job. Release the quota slot.
        releaseQuota(job.ip, job.reservation);
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
    mode: providerReady() ? 'provider' : 'setup-required',
    generationLimit: GENERATION_LIMIT,
    generationWindowMs: GENERATION_WINDOW_MS
  });
});

// Create video job
app.post('/api/generate', (req, res) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

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

  const jobId = `sf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Reserve a slot before accepting the request.
  const reservation = reserveQuota(ip, jobId);

  if (!reservation) {
    return res.status(429).json({
      error: 'Generation limit reached for this hour. Please wait before trying again.',
      limit: GENERATION_LIMIT,
      windowMs: GENERATION_WINDOW_MS
    });
  }

  const job = {
    jobId,
    model: MODEL,
    prompt,
    seconds,
    aspectRatio,
    status: 'queued',
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ip,
    reservation
  };

  jobs.set(jobId, job);

  // Respond immediately. Provider submission runs in the background.
  res.json({
    jobId,
    status: 'queued',
    model: MODEL
  });

  submitWithQueueRetries(job).catch(error => {
    job.status = 'failed';
    job.error = error.message || 'Unexpected backend error.';
    job.updatedAt = Date.now();

    // Safety release if an unexpected error occurs.
    releaseQuota(ip, reservation);
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

// Start server
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StoryForge running on port ${PORT}`);
  });
}

module.exports = {
  app,
  jobs,
  generationRequests
};
