
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // STORAGE
  // =========================================================

  const SCENE_STORAGE_KEY = 'storyforge_production_scenes';
  const CONFIG_STORAGE_KEY = 'storyforge_config';

  let scenes = [];
  let selectedSceneId = null;

  const loadScenes = () => {
    try {
      const saved = localStorage.getItem(SCENE_STORAGE_KEY);
      scenes = saved ? JSON.parse(saved) : [];

      if (!Array.isArray(scenes)) {
        scenes = [];
      }
    } catch (error) {
      scenes = [];
      console.error('Could not load scenes:', error);
    }
  };

  const persistScenes = () => {
    try {
      localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes));
      return true;
    } catch (error) {
      console.error('Could not save scenes:', error);
      alert('Scenes could not be saved in this browser.');
      return false;
    }
  };

  const createId = () =>
    'scene_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  // =========================================================
  // ELEMENTS
  // =========================================================

  const sceneList = document.getElementById('sceneList');
  const sceneCount = document.getElementById('sceneEditorCount');
  const sceneTimeline = document.getElementById('sceneTimeline');

  const addSceneBtn = document.getElementById('addSceneBtn');

  const emptyPanel = document.getElementById('sceneDetailEmpty');
  const editorForm = document.getElementById('sceneEditorForm');

  const saveSceneBtn = document.getElementById('saveSceneBtn');
  const deleteSceneBtn = document.getElementById('deleteSceneBtn');

  const fields = {
    title: document.getElementById('sceneTitleInput'),
    description: document.getElementById('sceneDescriptionInput'),
    location: document.getElementById('sceneLocationInput'),
    characters: document.getElementById('sceneCharactersInput'),
    action: document.getElementById('sceneActionInput'),
    dialogue: document.getElementById('sceneDialogueInput'),
    duration: document.getElementById('sceneDurationInput'),
    camera: document.getElementById('sceneCameraInput'),
    animation: document.getElementById('sceneAnimationInput'),
    notes: document.getElementById('sceneNotesInput')
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const getScene = (id) => scenes.find(scene => scene.id === id);

  const getSceneNumber = (id) => scenes.findIndex(scene => scene.id === id) + 1;

  const getFieldValue = (field) => field ? field.value.trim() : '';

  const setFieldValue = (field, value) => {
    if (field) field.value = value ?? '';
  };

  const escapeText = (value) => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  };

  const updateSceneCount = () => {
    if (sceneCount) {
      sceneCount.textContent = scenes.length;
    }

    const overviewCount = document.getElementById('sceneCount');

    if (overviewCount) {
      overviewCount.textContent = scenes.length;
    }

    const totalDuration = scenes.reduce((total, scene) => {
      const duration = Number(scene.duration);
      return total + (Number.isFinite(duration) ? duration : 0);
    }, 0);

    const durationDisplay = document.getElementById('totalSceneDuration');

    if (durationDisplay) {
      durationDisplay.textContent = totalDuration + ' sec';
    }
  };

  // =========================================================
  // EDITOR
  // =========================================================

  const clearEditor = () => {
    Object.values(fields).forEach(field => setFieldValue(field, ''));

    if (emptyPanel) {
      emptyPanel.hidden = false;
    }

    if (editorForm) {
      editorForm.hidden = true;
    }
  };

  const openEditor = (scene) => {
    if (!scene) {
      clearEditor();
      return;
    }

    selectedSceneId = scene.id;

    if (emptyPanel) {
      emptyPanel.hidden = true;
    }

    if (editorForm) {
      editorForm.hidden = false;
    }

    setFieldValue(fields.title, scene.title);
    setFieldValue(fields.description, scene.description);
    setFieldValue(fields.location, scene.location);
    setFieldValue(fields.characters, scene.characters);
    setFieldValue(fields.action, scene.action);
    setFieldValue(fields.dialogue, scene.dialogue);
    setFieldValue(fields.duration, scene.duration);
    setFieldValue(fields.camera, scene.camera);
    setFieldValue(fields.animation, scene.animation);
    setFieldValue(fields.notes, scene.notes);

    renderSceneList();
  };

  const collectEditorData = () => ({
    title: getFieldValue(fields.title),
    description: getFieldValue(fields.description),
    location: getFieldValue(fields.location),
    characters: getFieldValue(fields.characters),
    action: getFieldValue(fields.action),
    dialogue: getFieldValue(fields.dialogue),
    duration: getFieldValue(fields.duration),
    camera: getFieldValue(fields.camera),
    animation: getFieldValue(fields.animation),
    notes: getFieldValue(fields.notes)
  });

  // =========================================================
  // SCENE LIST
  // =========================================================

  const renderSceneList = () => {
    if (!sceneList) return;

    sceneList.innerHTML = '';

    if (scenes.length === 0) {
      sceneList.innerHTML =
        '<div class="scene-list-empty">No scenes yet. Create your first scene.</div>';
      return;
    }

    scenes.forEach((scene, index) => {
      const card = document.createElement('div');

      card.className = 'scene-list-item';

      if (scene.id === selectedSceneId) {
        card.classList.add('active');
      }

      const title = scene.title || 'Untitled Scene ' + (index + 1);

      card.innerHTML = `
        <div class="scene-card-content">
          <button type="button" class="scene-select-btn" data-scene-select="${escapeText(scene.id)}">
            <span class="scene-card-number">SCENE ${index + 1}</span>
            <span class="scene-card-title">${escapeText(title)}</span>
            <span class="scene-card-duration">${escapeText(scene.duration || '0')} sec</span>
          </button>

          <div class="scene-order-controls">
            <button type="button" data-scene-up="${escapeText(scene.id)}" aria-label="Move scene up" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-scene-down="${escapeText(scene.id)}" aria-label="Move scene down" ${index === scenes.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
        </div>
      `;

      sceneList.appendChild(card);
    });
  };

  // =========================================================
  // TIMELINE
  // =========================================================

  const renderTimeline = () => {
    if (!sceneTimeline) return;

    sceneTimeline.innerHTML = '';

    if (scenes.length === 0) {
      sceneTimeline.innerHTML =
        '<div class="timeline-empty">Your scene timeline will appear here.</div>';
      return;
    }

    scenes.forEach((scene, index) => {
      const item = document.createElement('div');

      item.className = 'scene-timeline-item';

      item.innerHTML = `
        <div class="timeline-scene-number">${index + 1}</div>
        <div class="timeline-scene-title">${escapeText(scene.title || 'Untitled Scene')}</div>
        <div class="timeline-scene-time">${escapeText(scene.duration || '0')} sec</div>
      `;

      sceneTimeline.appendChild(item);
    });
  };

  const renderAll = () => {
    renderSceneList();
    renderTimeline();
    updateSceneCount();
  };

  // =========================================================
  // ADD SCENE
  // =========================================================

  const addScene = () => {
    const scene = {
      id: createId(),
      title: 'Scene ' + (scenes.length + 1),
      description: '',
      location: '',
      characters: '',
      action: '',
      dialogue: '',
      duration: '30',
      camera: '',
      animation: '',
      notes: ''
    };

    scenes.push(scene);

    persistScenes();
    renderAll();
    openEditor(scene);

    if (fields.title) {
      fields.title.focus();
      fields.title.select();
    }
  };

  // =========================================================
  // SAVE SCENE
  // =========================================================

  const saveScene = () => {
    const scene = getScene(selectedSceneId);

    if (!scene) {
      alert('Select a scene before saving.');
      return;
    }

    Object.assign(scene, collectEditorData());

    if (!scene.title) {
      scene.title = 'Scene ' + getSceneNumber(scene.id);
    }

    persistScenes();
    renderAll();
    openEditor(scene);
  };

  // =========================================================
  // DELETE SCENE
  // =========================================================

  const deleteScene = () => {
    const scene = getScene(selectedSceneId);

    if (!scene) return;

    const confirmed = confirm('Delete "' + (scene.title || 'this scene') + '"?');

    if (!confirmed) return;

    scenes = scenes.filter(item => item.id !== scene.id);
    selectedSceneId = null;

    persistScenes();
    renderAll();
    clearEditor();
  };

  // =========================================================
  // REORDER
  // =========================================================

  const moveScene = (id, direction) => {
    const index = scenes.findIndex(scene => scene.id === id);

    if (index === -1) return;

    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= scenes.length) return;

    const temp = scenes[index];

    scenes[index] = scenes[newIndex];
    scenes[newIndex] = temp;

    persistScenes();
    renderAll();

    if (selectedSceneId) {
      openEditor(getScene(selectedSceneId));
    }
  };

  // =========================================================
  // EVENTS
  // =========================================================

  if (addSceneBtn) {
    addSceneBtn.addEventListener('click', addScene);
  }

  if (saveSceneBtn) {
    saveSceneBtn.addEventListener('click', saveScene);
  }

  if (deleteSceneBtn) {
    deleteSceneBtn.addEventListener('click', deleteScene);
  }

  if (sceneList) {
    sceneList.addEventListener('click', (event) => {
      const selectButton = event.target.closest('[data-scene-select]');
      const upButton = event.target.closest('[data-scene-up]');
      const downButton = event.target.closest('[data-scene-down]');

      if (selectButton) {
        openEditor(getScene(selectButton.dataset.sceneSelect));
      }

      if (upButton) {
        moveScene(upButton.dataset.sceneUp, -1);
      }

      if (downButton) {
        moveScene(downButton.dataset.sceneDown, 1);
      }
    });
  }

  // =========================================================
  // NAVIGATION
  // =========================================================

  const navButtons = document.querySelectorAll(
    '[data-view], [data-open-view], [data-navigate-view]'
  );

  const views = document.querySelectorAll('.workspace-view');

  const switchView = (viewName) => {
    if (!viewName) return;

    const target = document.getElementById('view-' + viewName);

    if (!target) return;

    views.forEach(view => {
      view.classList.remove('active');
    });

    target.classList.add('active');

    navButtons.forEach(button => {
      const buttonView =
        button.dataset.view ||
        button.dataset.openView ||
        button.dataset.navigateView;

      button.classList.toggle('active', buttonView === viewName);
    });

    try {
      sessionStorage.setItem('storyforge_active_view', viewName);
    } catch (error) {
      console.warn('Could not save active view.');
    }
  };

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const viewName =
        button.dataset.view ||
        button.dataset.openView ||
        button.dataset.navigateView;

      switchView(viewName);
    });
  });

  // =========================================================
  // CONFIGURATION
  // =========================================================

  const loadConfiguration = () => {
    let config = null;

    try {
      const saved = sessionStorage.getItem(CONFIG_STORAGE_KEY);

      if (saved) {
        config = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Could not load Studio configuration:', error);
    }

    if (!config) return;

    const configDisplay = document.getElementById('productionConfig');

    if (configDisplay) {
      configDisplay.textContent = JSON.stringify(config, null, 2);
    }

    const storyIdea = document.getElementById('productionStoryIdea');

    if (storyIdea) {
      storyIdea.textContent =
        config.storyIdea || config.idea || config.prompt || 'No story idea saved.';
    }

    const genreDisplay = document.getElementById('productionGenres');

    if (genreDisplay) {
      const genres = config.genres || config.genre || [];
      genreDisplay.textContent = Array.isArray(genres)
        ? genres.join(', ')
        : String(genres || 'Not specified');
    }
  };

  // =========================================================
  // INITIALIZE
  // =========================================================

  loadScenes();
  loadConfiguration();
  renderAll();

  clearEditor();

  try {
    const savedView = sessionStorage.getItem('storyforge_active_view');

    if (savedView) {
      switchView(savedView);
    }
  } catch (error) {
    console.warn('Could not restore the previous view.');
  }

  console.log('StoryForge Production Studio initialized.');
});
                                             
