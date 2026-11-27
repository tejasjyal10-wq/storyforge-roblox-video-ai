(() => {
  const $ = (id) => document.getElementById(id);
  const video = $('reviewVideo'), empty = $('videoEmpty'), fileInput = $('videoFile');
  let currentUrl = null, rating = 0, briefReady = false;
  const storageKey = 'storyforge-final-review-v1';

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  }
  function persist() {
    const data = { rating, feedback: $('feedback').value, selected: [...document.querySelectorAll('.improvement-option input:checked')].map(x => x.value) };
    try { localStorage.setItem(storageKey, JSON.stringify(data)); $('saveStatus').textContent = 'Notes saved on this device.'; }
    catch { $('saveStatus').textContent = 'Could not save locally in this browser.'; }
  }
  function loadSaved() {
    const data = readSaved();
    rating = Number(data.rating) || 0;
    $('feedback').value = data.feedback || '';
    document.querySelectorAll('.rating').forEach(b => b.classList.toggle('selected', Number(b.dataset.rating) === rating));
    document.querySelectorAll('.improvement-option input').forEach(x => x.checked = (data.selected || []).includes(x.value));
  }
  function setVideo(file) {
    if (!file || !file.type.startsWith('video/')) { $('saveStatus').textContent = 'Please select a valid video file.'; return; }
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);
    video.src = currentUrl; video.hidden = false; empty.hidden = true;
    $('videoName').textContent = file.name; $('changeVideo').hidden = false;
    video.load();
  }
  fileInput.addEventListener('change', () => setVideo(fileInput.files && fileInput.files[0]));
  $('changeVideo').addEventListener('click', () => fileInput.click());
  document.querySelectorAll('.rating').forEach(btn => btn.addEventListener('click', () => {
    rating = Number(btn.dataset.rating);
    document.querySelectorAll('.rating').forEach(b => b.classList.toggle('selected', b === btn));
    persist();
  }));
  $('saveFeedback').addEventListener('click', persist);
  $('feedback').addEventListener('input', () => { $('saveStatus').textContent = 'Unsaved changes'; });
  document.querySelectorAll('.improvement-option input').forEach(x => x.addEventListener('change', () => { briefReady = false; $('copyBrief').disabled = true; }));
  $('buildBrief').addEventListener('click', () => {
    const areas = [...document.querySelectorAll('.improvement-option input:checked')].map(x => x.value);
    const notes = $('feedback').value.trim();
    const ratingText = rating ? ({1:'Needs work',2:'Getting there',3:'Good',4:'Great'}[rating]) : 'Not rated';
    if (!areas.length && !notes) { $('briefText').textContent = 'Choose at least one improvement area or add feedback notes first.'; $('briefOutput').hidden = false; return; }
    const brief = [
      'STORYFORGE VIDEO IMPROVEMENT BRIEF',
      `Overall review: ${ratingText}`,
      `Focus areas: ${areas.length ? areas.join(', ') : 'Use the reviewer notes'}`,
      '', 'Reviewer notes:', notes || 'No additional notes provided.',
      '', 'Requested next step: revise the video using the selected focus areas and reviewer notes. Preserve the story intent and continuity unless the notes request otherwise.'
    ].join('\n');
    $('briefText').textContent = brief; $('briefOutput').hidden = false; briefReady = true; $('copyBrief').disabled = false;
    persist();
  });
  $('copyBrief').addEventListener('click', async () => {
    if (!briefReady) return;
    try { await navigator.clipboard.writeText($('briefText').textContent); $('saveStatus').textContent = 'Improvement brief copied.'; }
    catch { $('saveStatus').textContent = 'Clipboard access unavailable—select and copy the brief manually.'; }
  });
  loadSaved();
  window.addEventListener('pagehide', () => { if (currentUrl) URL.revokeObjectURL(currentUrl); });
})();
