'use strict';

(() => {
  const video = document.getElementById('productionVideo');
  const placeholder = document.getElementById('videoPlaceholder');
  const percent = document.getElementById('progressPercentage');
  const fill = document.getElementById('progressFill');
  const status = document.getElementById('generationStatus');
  const generateBtn = document.getElementById('generateVideoBtn');
  const downloadBtn = document.getElementById('downloadVideoBtn');
  const promptBox = document.getElementById('generationPrompt');
  const feedbackSection = document.getElementById('feedbackSection');
  const improvementsSection = document.getElementById('improvementsSection');
  const feedbackInput = document.getElementById('feedbackInput');
  const improvementsInput = document.getElementById('improvementsInput');

  const CONFIG_KEY = 'storyforge_config';
  let currentJobId = null;
  let polling = false;
  let latestVideoUrl = '';

  function setProgress(value) {
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    if (percent) percent.textContent = `${Math.round(safe)}%`;
    if (fill) fill.style.width = `${safe}%`;
  }

  function setStatus(message, kind = 'info') {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function loadConfig() {
    try {
      const raw = sessionStorage.getItem(CONFIG_KEY);
      if (!raw) return null;
      const config = JSON.parse(raw);
      return config && typeof config === 'object' ? config : null;
    } catch {
      return null;
    }
  }

  function buildPrompt(config) {
    const idea = String(config.storyIdea || '').trim();
    const genres = Array.isArray(config.genres) ? config.genres.filter(Boolean).join(', ') : String(config.mainGenre || 'Adventure');
    const style = String(config.visualStyle || 'Roblox Cinematic');
    const characterMode = String(config.characterMode || 'automatic');
    const audio = config.audio || {};
    const audioNotes = [
      audio.backgroundMusic ? 'Include fitting background music.' : 'Do not add background music.',
      audio.soundEffects ? 'Include appropriate environmental and action sound effects.' : 'Avoid sound effects.',
      audio.voiceNarration ? 'Use voice narration where it fits.' : 'No voice narration.',
      audio.characterDialogue ? 'Use natural character dialogue if appropriate.' : 'No character dialogue.'
    ].join(' ');
    return [
      'Create a single cinematic video clip based on the following story concept.',
      `Story: ${idea}`,
      `Genre: ${genres}`,
      `Visual style: ${style}`,
      `Character direction: ${characterMode === 'library' ? 'Use the selected saved character style if available; otherwise use characters appropriate to the story.' : characterMode === 'new' ? 'Create new characters appropriate to the story.' : 'Cast characters automatically based on the story.'}`,
      audioNotes,
      'Use coherent visual continuity, clear subject movement, cinematic composition, and a beginning-to-end moment. Do not add captions, logos, or watermarks unless explicitly requested.'
    ].join('\n\n');
  }

  async function checkHealth() {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `Health check failed (${response.status})`);
    if (!data.providerConfigured) throw new Error('The video provider is not configured on the server. Add AGNES_API_KEY in the hosting environment before generating.');
    return data;
  }

  async function requestGeneration(prompt, config) {
    const seconds = 8; // Stage 1 proves one provider clip; multi-clip assembly comes later.
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ prompt, seconds, aspect_ratio: '16:9' })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Generation request failed (${response.status})`);
    if (!data.jobId) throw new Error('Backend did not return a generation job ID.');
    return data;
  }

  async function pollJob(jobId) {
    const maxChecks = 15;
    for (let check = 1; check <= maxChecks; check++) {
      if (!polling) return;
      setStatus(`Video generation is running… status check ${check}/${maxChecks}`, 'working');
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Status check failed (${response.status})`);

      if (data.status === 'completed' && data.videoUrl) {
        showVideo(data.videoUrl);
        setProgress(100);
        setStatus('Video generated successfully. Play it below or download it.', 'success');
        return;
      }
      if (data.status === 'failed') throw new Error(data.error || 'Video generation failed.');
      if (data.status === 'retry_wait' && data.retryAfterMs) {
        setStatus(`Provider queue is busy. Retrying automatically in ${Math.ceil(data.retryAfterMs / 1000)} seconds…`, 'working');
        await new Promise(resolve => setTimeout(resolve, data.retryAfterMs));
        continue;
      }
      const backendProgress = Number(data.progress);
      setProgress(Number.isFinite(backendProgress) && backendProgress > 0 ? backendProgress : Math.min(92, 8 + check * 5));
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    throw new Error('The provider is still processing, but Stage 1 monitoring reached its limit. Your job may continue on the provider. Use the resume option in the legacy studio if available, or try again later.');
  }

  function showVideo(url) {
    latestVideoUrl = url;
    if (video) {
      video.src = url;
      video.style.display = 'block';
      video.load();
    }
    if (placeholder) placeholder.style.display = 'none';
    if (downloadBtn) downloadBtn.disabled = false;
    if (feedbackSection) feedbackSection.hidden = false;
    if (improvementsSection) improvementsSection.hidden = false;
  }

  function disableGenerate(disabled) {
    if (!generateBtn) return;
    generateBtn.disabled = disabled;
    generateBtn.textContent = disabled ? 'GENERATING VIDEO…' : 'GENERATE VIDEO';
  }

  async function startGeneration() {
    if (polling) return;
    const config = loadConfig();
    if (!config || !String(config.storyIdea || '').trim()) {
      setStatus('No story found. Return to Studio and submit your story first.', 'error');
      return;
    }
    const prompt = buildPrompt(config);
    if (promptBox) promptBox.value = prompt;
    polling = true;
    disableGenerate(true);
    setProgress(5);
    setStatus('Checking video provider configuration…', 'working');
    if (placeholder) placeholder.style.display = 'flex';
    if (video) video.style.display = 'none';
    try {
      await checkHealth();
      setProgress(10);
      setStatus('Submitting your story to the video provider…', 'working');
      const job = await requestGeneration(prompt, config);
      currentJobId = job.jobId;
      try { sessionStorage.setItem('storyforge_last_job', currentJobId); } catch {}
      setProgress(15);
      await pollJob(currentJobId);
    } catch (error) {
      setStatus(error.message || 'Something went wrong during video generation.', 'error');
      if (placeholder) {
        placeholder.style.display = 'flex';
        const heading = placeholder.querySelector('h2');
        if (heading) heading.textContent = 'Video generation did not finish';
      }
    } finally {
      polling = false;
      disableGenerate(false);
    }
  }

  if (generateBtn) generateBtn.addEventListener('click', startGeneration);
  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.addEventListener('click', () => {
      if (!latestVideoUrl) return;
      const link = document.createElement('a');
      link.href = latestVideoUrl;
      link.download = 'StoryForge_Video.mp4';
      link.target = '_blank';
      link.rel = 'noopener';
      link.click();
    });
  }

  // Feedback notes are saved locally for the current story.
  const storyId = (loadConfig() && loadConfig().id) || 'default';
  const notesKey = `storyforge_production_notes_${storyId}`;
  function loadNotes() {
    try {
      const notes = JSON.parse(localStorage.getItem(notesKey) || '{}');
      if (feedbackInput) feedbackInput.value = notes.feedback || '';
      if (improvementsInput) improvementsInput.value = notes.improvements || '';
    } catch {}
  }
  function saveNotes() {
    try {
      localStorage.setItem(notesKey, JSON.stringify({
        feedback: feedbackInput ? feedbackInput.value : '',
        improvements: improvementsInput ? improvementsInput.value : '',
        updatedAt: new Date().toISOString()
      }));
    } catch {}
  }
  if (feedbackInput) feedbackInput.addEventListener('input', saveNotes);
  if (improvementsInput) improvementsInput.addEventListener('input', saveNotes);
  loadNotes();

  const savedJob = sessionStorage.getItem('storyforge_last_job');
  if (savedJob && !loadConfig()) setStatus(`Last job ID: ${savedJob}. Return to Studio to start a new generation.`, 'info');
  setStatus('Your story is ready. Press Generate Video to send it to the provider.', 'info');
})();
