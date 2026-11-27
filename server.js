'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const app = express();

// CORS must run before routes so browser preflight requests are handled.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '2mb' }));

// Story Director API used by the Production scene generator.
const { createStoryDirectorRouter } = require('./storyforge-story-director');
app.use('/api/story-director', createStoryDirectorRouter());


// Learning API (kept from the original server).
const { createLearningRouter } = require('./storyforge-learning');
app.use('/api/learning', createLearningRouter());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));


const BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com').replace(/\/$/, '');
const MODEL = process.env.AGNES_VIDEO_MODEL || 'agnes-video-2.5-flash';
const KEY = process.env.AGNES_API_KEY;


// In-memory stores. Data resets on a server restart; use a database for persistence.
const jobs = new Map();
const generationRequests = new Map();
const reviews = new Map();
const feedbackItems = new Map();
const revisionPlans = new Map();
const versions = new Map();
const videoApprovals = new Map();

const GENERATION_LIMIT = 3;
const GENERATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_PROVIDER_STATUS_CHECKS = 15;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];
const now = () => Date.now();
const id = prefix => `${prefix}_${now()}_${crypto.randomBytes(4).toString('hex')}`;
const providerReady = () => Boolean(KEY && KEY.trim());


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
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) {
    const message = data?.message || data?.error || raw.slice(0, 300);
    const error = new Error(`Provider ${response.status}: ${message}`);
    error.status = response.status;
    error.providerData = data;
    throw error;
  }
  return data;
}


async function submitWithQueueRetries(job) {
  const prompt = job.prompt;
  let retries = 0;
  while (true) {
    job.status = retries ? 'retrying' : 'submitting';
    job.retryCount = retries;
    job.updatedAt = now();
    try {
      const data = await apiFetch(`${BASE}/v1/videos`, {
        method: 'POST',
        body: JSON.stringify({
          model: MODEL,
          prompt,
          mode: 'text',
          seconds: String(job.seconds),
          size: '720P',
          aspect_ratio: job.aspectRatio
        })
      });
      const videoId = data.video_id || data.id;
      if (!videoId) throw new Error('Provider response did not include video_id.');
      job.videoId = videoId;
      job.status = 'processing';
      job.providerData = data;
      job.updatedAt = now();
      return;
    } catch (error) {
      const queueFull = error.status === 503 && /queue\s+is\s+full/i.test(error.message);
      if (!queueFull || retries >= RETRY_DELAYS_MS.length) {
        job.status = 'failed';
        job.error = queueFull
          ? 'The video provider queue is still full after automatic retries. Please try again later.'
          : error.message;
        job.providerData = error.providerData || null;
        job.updatedAt = now();
        return;
      }
      const delay = RETRY_DELAYS_MS[retries++];
      job.status = 'retry_wait';
      job.retryCount = retries;
      job.retryAfterMs = delay;
      job.updatedAt = now();
      await sleep(delay);
    }
  }
}


function safeJob(job) {
  return {
    jobId: job.jobId, status: job.status, error: job.error,
    retryCount: job.retryCount, retryAfterMs: job.retryAfterMs,
    model: job.model, createdAt: job.createdAt, updatedAt: job.updatedAt,
    videoId: job.videoId, videoUrl: job.videoUrl, progress: job.progress,
    statusChecks: job.statusChecks, monitoringLimitReached: job.monitoringLimitReached,
    versionId: job.versionId, videoKey: job.videoKey
  };
}


function ensureVideo(videoKey, initialUrl = null) {
  let record = reviews.get(videoKey);
  if (!record) {
    record = {
      videoKey,
      createdAt: now(),
      updatedAt: now(),
      videoUrl: initialUrl,
      feedback: [],
      versions: [],
      approvedVersionId: null
    };
    reviews.set(videoKey, record);
    const first = {
      versionId: id('ver'), videoKey, versionNumber: 1,
      parentVersionId: null, jobId: null, videoUrl: initialUrl,
      prompt: null, notes: 'Original video', changedScenes: [],
      status: initialUrl ? 'available' : 'created', approved: false, createdAt: now()
    };
    versions.set(videoKey, [first]);
    record.versions.push(first.versionId);
  } else if (initialUrl && !record.videoUrl) {
    record.videoUrl = initialUrl;
    record.updatedAt = now();
  }
  return record;
}
function getVersionList(videoKey) {
  return versions.get(videoKey) || [];
}
function latestVersion(videoKey) {
  const list = getVersionList(videoKey);
  return list[list.length - 1] || null;
}
function makeVersion(videoKey, data = {}) {
  const list = getVersionList(videoKey);
  const parent = data.parentVersionId ? list.find(v => v.versionId === data.parentVersionId) : latestVersion(videoKey);
  const v = {
    versionId: id('ver'), videoKey,
    versionNumber: list.length + 1,
    parentVersionId: parent?.versionId || null,
    jobId: data.jobId || null,
    videoUrl: data.videoUrl || null,
    prompt: data.prompt || null,
    notes: data.notes || '',
    changedScenes: Array.isArray(data.changedScenes) ? data.changedScenes : [],
    status: data.status || 'generating',
    approved: false,
    createdAt: now()
  };
  list.push(v);
  versions.set(videoKey, list);
  const record = ensureVideo(videoKey);
  record.versions.push(v.versionId);
  record.updatedAt = now();
  return v;
}
function attachJobToVersion(job, version) {
  if (!version) return;
  job.videoKey = version.videoKey;
  job.versionId = version.versionId;
  version.jobId = job.jobId;
}
function createJob({ prompt, seconds = 8, aspectRatio = '16:9', videoKey = null, version = null }) {
  const timestamp = now();
  const jobId = id('sf');
  const job = {
    jobId, model: MODEL, prompt, seconds,
    aspectRatio, status: 'queued', retryCount: 0,
    createdAt: timestamp, updatedAt: timestamp,
    statusChecks: 0, monitoringLimitReached: false,
  };
  jobs.set(jobId, job);
  if (version) attachJobToVersion(job, version);
  submitWithQueueRetries(job).catch(error => {
    job.status = 'failed'; job.error = error.message || 'Unexpected backend error.'; job.updatedAt = now();
    if (version) version.status = 'failed';
  });
  return job;
}


// Health check
app.get('/api/health', (_req, res) => res.json({
  ok: true, providerConfigured: providerReady(), model: MODEL,
  mode: providerReady() ? 'provider' : 'setup-required',
  monitoringMaxChecks: MAX_PROVIDER_STATUS_CHECKS
}));


// Create a video generation job
app.post('/api/generate', (req, res) => {
  const timestamp = now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const recent = (generationRequests.get(ip) || []).filter(t => timestamp - t < GENERATION_WINDOW_MS);
  if (recent.length >= GENERATION_LIMIT) {
    generationRequests.set(ip, recent);
    return res.status(429).json({ error: 'Generation limit reached for this hour. Please wait before trying again.' });
  }
  if (!providerReady()) return res.status(503).json({ error: 'Video API is not configured. Add AGNES_API_KEY to the server environment.' });
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Please enter a story or scene prompt.' });
  const seconds = Math.max(4, Math.min(12, Number(req.body.seconds) || 8));
  const aspectRatio = ['16:9', '9:16', '1:1'].includes(req.body.aspect_ratio) ? req.body.aspect_ratio : '16:9';
  recent.push(timestamp); generationRequests.set(ip, recent);
  const job = createJob({ prompt, seconds, aspectRatio });
  // Register the original generation as Version 1 so review/version routes work from its jobId.
  const record = ensureVideo(job.jobId);
  const originalVersion = getVersionList(job.jobId)[0];
  originalVersion.jobId = job.jobId;
  originalVersion.prompt = prompt;
  originalVersion.status = 'generating';
  job.videoKey = job.jobId;
  job.versionId = originalVersion.versionId;
  res.json({ jobId: job.jobId, videoKey: job.jobId, versionId: originalVersion.versionId, status: job.status, model: MODEL });
});


// Job status. The 15-check limit affects monitoring only; it does NOT cancel provider generation.
app.get('/api/jobs/:jobId', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found. It may have expired after a server restart.' });
  if (!job.videoId || ['queued', 'submitting', 'retrying', 'retry_wait', 'failed'].includes(job.status)) return res.json(safeJob(job));
  if (job.status === 'completed') return res.json(safeJob(job));
  if (job.monitoringLimitReached) return res.json(safeJob(job));
  if (job.statusChecks >= MAX_PROVIDER_STATUS_CHECKS) {
    job.monitoringLimitReached = true;
    job.updatedAt = now();
    return res.json(safeJob(job));
  }
  // Prevent concurrent duplicate provider checks for a single job.
  if (job.statusCheckPromise) {
    try { await job.statusCheckPromise; } catch { /* handled by the request below */ }
    return res.json(safeJob(job));
  }
  job.statusChecks++;
  job.statusCheckPromise = (async () => {
    const params = new URLSearchParams({ video_id: job.videoId, model_name: job.model });
    const data = await apiFetch(`${BASE}/agnesapi?${params}`);
    const providerStatus = String(data.status || '').toLowerCase();
    const url = data.url || data.video_url || data.output?.url || data.result?.url;
    if (['completed', 'complete', 'success', 'succeeded', 'done'].includes(providerStatus) && url) {
      job.status = 'completed'; job.videoUrl = url; job.providerData = data;
      if (job.versionId && job.videoKey) {
        const v = getVersionList(job.videoKey).find(x => x.versionId === job.versionId);
        if (v) { v.videoUrl = url; v.status = 'available'; }
        const record = ensureVideo(job.videoKey, url); record.videoUrl = url; record.updatedAt = now();
      }
    } else if (['failed', 'error', 'cancelled'].includes(providerStatus)) {
      job.status = 'failed'; job.error = data.error || data.message || 'Video generation failed'; job.providerData = data;
      if (job.versionId && job.videoKey) { const v = getVersionList(job.videoKey).find(x => x.versionId === job.versionId); if (v) v.status = 'failed'; }
    } else {
      job.status = providerStatus || 'processing'; job.progress = Number(data.progress) || 0;
    }
    job.updatedAt = now();
  })();
  try { await job.statusCheckPromise; res.json(safeJob(job)); }
  catch (error) { res.status(502).json({ error: error.message, jobId: job.jobId, status: job.status }); }
  finally { job.statusCheckPromise = null; }
});


// Video review workspace data. videoKey can be the original jobId or a generated videoKey.
app.get('/api/videos/:videoKey/review', (req, res) => {
  const key = req.params.videoKey;
  const record = ensureVideo(key);
  const list = getVersionList(key);
  res.json({ videoKey: key, videoUrl: record.videoUrl, feedback: record.feedback,
    versions: list, approvedVersionId: record.approvedVersionId, updatedAt: record.updatedAt });
});


// Save user feedback (whole-video or scene-specific).
app.post('/api/videos/:videoKey/feedback', (req, res) => {
  const key = req.params.videoKey;
  const text = String(req.body?.text || req.body?.feedback || '').trim();
  if (!text) return res.status(400).json({ error: 'Feedback text is required.' });
  const record = ensureVideo(key, req.body?.videoUrl || null);
  const feedback = {
    feedbackId: id('fb'), videoKey: key,
    scope: req.body?.sceneId ? 'scene' : 'video',
    sceneId: req.body?.sceneId ? String(req.body.sceneId) : null,
    category: String(req.body?.category || 'general').slice(0, 80),
    text, createdAt: now(), status: 'submitted'
  };
  feedbackItems.set(feedback.feedbackId, feedback);
  record.feedback.push(feedback); record.updatedAt = now();
  res.status(201).json(feedback);
});


// Feedback analysis. This is a transparent local rules-based plan, not an LLM call.
app.post('/api/videos/:videoKey/analyze-feedback', (req, res) => {
  const key = req.params.videoKey;
  const record = ensureVideo(key);
  const requestedIds = Array.isArray(req.body?.feedbackIds) ? req.body.feedbackIds : record.feedback.map(f => f.feedbackId);
  const selected = record.feedback.filter(f => requestedIds.includes(f.feedbackId));
  if (!selected.length) return res.status(400).json({ error: 'No saved feedback selected to analyze.' });
  const plan = {
    planId: id('plan'), videoKey: key, createdAt: now(), status: 'awaiting_confirmation',
    items: selected.map((f, index) => ({
      itemId: `item_${index + 1}`, feedbackId: f.feedbackId,
      scope: f.scope, sceneId: f.sceneId, category: f.category,
      instruction: f.text,
      action: f.sceneId ? 'Revise the specified scene using the feedback.' : 'Apply this feedback across the video where relevant.'
    })),
    note: 'This plan is assembled from saved feedback using local rules. It has not been reviewed by an AI model.'
  };
  revisionPlans.set(plan.planId, plan);
  res.json(plan);
});


// Apply a confirmed feedback plan by creating a new generation/version. The prior version remains intact.
app.post('/api/videos/:videoKey/revisions', (req, res) => {
  if (!providerReady()) return res.status(503).json({ error: 'Video API is not configured. Add AGNES_API_KEY to the server environment.' });
  const key = req.params.videoKey;
  const planId = String(req.body?.planId || '');
  const plan = revisionPlans.get(planId);
  if (!plan || plan.videoKey !== key) return res.status(404).json({ error: 'Revision plan not found for this video.' });
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Set confirm=true to start the revision generation.' });
  const parentVersionId = req.body?.parentVersionId || latestVersion(key)?.versionId || null;
  const parent = getVersionList(key).find(v => v.versionId === parentVersionId) || latestVersion(key);
  const feedbackText = plan.items.map(item => `${item.sceneId ? `Scene ${item.sceneId}: ` : ''}${item.instruction}`).join('\n');
  const originalPrompt = parent?.prompt || String(req.body?.originalPrompt || 'Create the requested video.');
  const revisionPrompt = `${originalPrompt}\n\nREVISION REQUESTS (apply these changes while preserving the rest of the story, style, and continuity):\n${feedbackText}`;
  const seconds = Math.max(4, Math.min(12, Number(req.body.seconds) || 8));
  const aspectRatio = ['16:9', '9:16', '1:1'].includes(req.body.aspect_ratio) ? req.body.aspect_ratio : '16:9';
  const version = makeVersion(key, { parentVersionId: parent?.versionId, prompt: revisionPrompt, notes: `Revision from feedback plan ${planId}`, changedScenes: plan.items.map(i => i.sceneId).filter(Boolean) });
  const job = createJob({ prompt: revisionPrompt, seconds, aspectRatio, videoKey: key, version });
  plan.status = 'applied'; plan.appliedAt = now(); plan.createdVersionId = version.versionId;
  res.status(202).json({ jobId: job.jobId, status: job.status, version, plan });
});


// List versions
app.get('/api/videos/:videoKey/versions', (req, res) => res.json({ videoKey: req.params.videoKey, versions: getVersionList(req.params.videoKey) }));
app.get('/api/videos/:videoKey/versions/:versionId', (req, res) => {
  const version = getVersionList(req.params.videoKey).find(v => v.versionId === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found.' });
  res.json(version);
});
// Restore is a new active pointer/version entry, preserving historical records.
app.post('/api/videos/:videoKey/versions/:versionId/restore', (req, res) => {
  const key = req.params.videoKey;
  const source = getVersionList(key).find(v => v.versionId === req.params.versionId);
  if (!source) return res.status(404).json({ error: 'Version not found.' });
  const record = ensureVideo(key, source.videoUrl);
  record.activeVersionId = source.versionId;
  record.videoUrl = source.videoUrl || record.videoUrl;
  record.updatedAt = now();
  res.json({ restored: true, videoKey: key, activeVersionId: source.versionId, videoUrl: source.videoUrl, note: 'Restored by setting the active version pointer; original version history is preserved.' });
});
// Compare two version metadata records (not frame-by-frame video analysis).
app.post('/api/videos/:videoKey/compare', (req, res) => {
  const key = req.params.videoKey;
  const list = getVersionList(key);
  const a = list.find(v => v.versionId === req.body?.versionA);
  const b = list.find(v => v.versionId === req.body?.versionB);
  if (!a || !b) return res.status(404).json({ error: 'Both version IDs must exist for this video.' });
  res.json({ videoKey: key, versionA: a, versionB: b,
    comparison: { versionNumbers: [a.versionNumber, b.versionNumber], notes: [a.notes, b.notes], changedScenes: [...new Set([...a.changedScenes, ...b.changedScenes])], promptsDiffer: a.prompt !== b.prompt, urlsDiffer: a.videoUrl !== b.videoUrl },
    note: 'Metadata comparison only; this endpoint does not inspect video frames or audio.' });
});
// Approve a version
app.post('/api/videos/:videoKey/approve', (req, res) => {
  const key = req.params.videoKey;
  const versionId = String(req.body?.versionId || latestVersion(key)?.versionId || '');
  const version = getVersionList(key).find(v => v.versionId === versionId);
  if (!version) return res.status(404).json({ error: 'Version not found.' });
  if (version.status !== 'available' || !version.videoUrl) return res.status(409).json({ error: 'Only a completed video version can be approved.' });
  const record = ensureVideo(key, version.videoUrl);
  for (const v of getVersionList(key)) v.approved = false;
  version.approved = true;
  record.approvedVersionId = versionId; record.updatedAt = now();
  videoApprovals.set(key, { versionId, approvedAt: now() });
  res.json({ approved: true, videoKey: key, versionId, approvedAt: videoApprovals.get(key).approvedAt });
});

// Start server
const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`StoryForge running on port ${PORT}`));
module.exports = { app, jobs, reviews, versions, revisionPlans };
