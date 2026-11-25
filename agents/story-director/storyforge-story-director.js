'use strict';

const DEFAULT_BASE_URL = process.env.STORYFORGE_LLM_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.STORYFORGE_LLM_MODEL || 'gpt-4o-mini';
const API_KEY = process.env.STORYFORGE_LLM_API_KEY;


function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}


function extractJson(content) {
  if (typeof content !== 'string') throw new Error('LLM response content was not text.');
  const trimmed = content.trim();
  try { return JSON.parse(trimmed); } catch (_) {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('LLM did not return valid JSON.');
}


function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('Plan must be a JSON object.');
  if (!plan.title || typeof plan.title !== 'string') throw new Error('Plan is missing a title.');
  if (!plan.logline || typeof plan.logline !== 'string') throw new Error('Plan is missing a logline.');
  if (!Array.isArray(plan.characters)) throw new Error('Plan characters must be an array.');
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) throw new Error('Plan must include at least one scene.');
  plan.scenes.forEach((scene, index) => {
    if (!scene || typeof scene !== 'object') throw new Error(`Scene ${index + 1} is invalid.`);
    if (!scene.scene_id) scene.scene_id = `scene_${index + 1}`;
    if (!scene.title || typeof scene.title !== 'string') scene.title = `Scene ${index + 1}`;
    if (!scene.duration_seconds || !Number.isFinite(Number(scene.duration_seconds))) scene.duration_seconds = 5;
    scene.duration_seconds = Math.max(1, Math.min(60, Number(scene.duration_seconds)));
    if (!Array.isArray(scene.characters)) scene.characters = [];
    if (!Array.isArray(scene.actions)) scene.actions = [];
  });
  if (!plan.visual_direction || typeof plan.visual_direction !== 'object') plan.visual_direction = {};
  if (!Array.isArray(plan.agent_tasks)) plan.agent_tasks = [];
  return plan;
}


function buildMessages(input) {
  const idea = String(input.idea || input.prompt || '').trim();
  if (!idea) throw new Error('Please provide a story idea.');
  const duration = Math.max(4, Math.min(180, Number(input.target_duration_seconds) || 30));
  const style = String(input.visual_style || 'Roblox-inspired 3D animation');
  const system = `You are StoryForge Story Director, a creative planning AI for short videos and Roblox-style story animations. Convert user ideas into practical production plans. Preserve the user's intent; do not add unrelated plot twists. Return ONLY valid JSON with this schema: {"title":"string","logline":"string","genre":"string","target_duration_seconds":number,"story_arc":{"beginning":"string","middle":"string","ending":"string"},"characters":[{"character_id":"string","name":"string","appearance":"string","personality":"string","role":"string"}],"scenes":[{"scene_id":"string","title":"string","duration_seconds":number,"location":"string","characters":["character_id"],"actions":["string"],"dialogue":[{"character_id":"string","text":"string"}],"camera":"string","lighting":"string","transition":"string"}],"visual_direction":{"style":"string","color_palette":["string"],"lighting":"string","camera_language":"string","continuity_notes":["string"]},"agent_tasks":[{"agent":"string","task":"string","inputs":["string"],"priority":"high|medium|low"}],"production_notes":["string"]}. Use concise actionable details. Scene durations should total approximately the target duration. Avoid unsafe or age-inappropriate content. Characters should have stable, reusable descriptions and IDs. Agent tasks should be useful to future specialized agents. Do not claim that any video has been generated.`;
  const user = `Create a production plan for this idea. Target duration: ${duration} seconds. Visual style: ${style}. User idea: ${idea}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}


async function createStoryDirectorAgent(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const apiKey = options.apiKey ?? API_KEY;
  const baseUrl = cleanBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 45000);

  return {
    name: 'StoryForge Story Director',
    model,
    async plan(input = {}) {
      const messages = buildMessages(input);
      if (!apiKey || !String(apiKey).trim()) {
        const err = new Error('Story Director LLM is not configured. Set STORYFORGE_LLM_API_KEY.');
        err.code = 'LLM_NOT_CONFIGURED';
        throw err;
      }
      if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable in this Node runtime.');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, temperature: 0.7, response_format: { type: 'json_object' } }),
          signal: controller.signal
        });
        const raw = await response.text();
        let data;
        try { data = JSON.parse(raw); } catch (_) { data = { raw }; }
        if (!response.ok) {
          const error = new Error(data?.error?.message || data?.message || `LLM provider returned HTTP ${response.status}`);
          error.status = response.status;
          error.providerData = data;
          throw error;
        }
        const content = data?.choices?.[0]?.message?.content;
        const plan = validatePlan(extractJson(content));
        return { ok: true, agent: this.name, model, plan };
      } catch (error) {
        if (error.name === 'AbortError') throw new Error(`Story Director timed out after ${timeoutMs}ms.`);
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}


function createStoryDirectorRouter(options = {}) {
  const express = require('express');
  const router = express.Router();
  const agentPromise = createStoryDirectorAgent(options);

  router.get('/status', async (_req, res) => {
    res.json({ agent: 'story-director', configured: Boolean(options.apiKey ?? API_KEY), model: options.model || DEFAULT_MODEL });
  });

  router.post('/plan', async (req, res) => {
    try {
      const agent = await agentPromise;
      const result = await agent.plan(req.body || {});
      res.json(result);
    } catch (error) {
      const status = error.code === 'LLM_NOT_CONFIGURED' ? 503 : (error.status || 502);
      res.status(status).json({ ok: false, agent: 'story-director', error: error.message });
    }
  });
  return router;
}


module.exports = { createStoryDirectorAgent, createStoryDirectorRouter, buildMessages, extractJson, validatePlan };
