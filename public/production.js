
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // STORYFORGE PRODUCTION STUDIO
  // =========================================================

  const CONFIG_STORAGE_KEY = 'storyforge_config';
  const LEGACY_SCENE_KEY = 'storyforge_production_scenes';
  const PROJECT_SCENE_PREFIX = 'storyforge_production_scenes_';

  let currentProjectId = 'default_project';
  let projectConfig = null;
  let scenes = [];
  let selectedSceneId = null;

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
  // PROJECT STORAGE
  // =========================================================

  const getProjectSceneKey = () => {
    return PROJECT_SCENE_PREFIX + currentProjectId;
  };

  const createId = () => {
    return 'scene_' + Date.now() + '_' +
      Math.random().toString(36).slice(2, 8);
  };

  const getScene = id => scenes.find(scene => scene.id === id);

  const getSceneNumber = id =>
    scenes.findIndex(scene => scene.id === id) + 1;

  const loadConfiguration = () => {
    try {
      const saved = sessionStorage.getItem(CONFIG_STORAGE_KEY);

      projectConfig = saved ? JSON.parse(saved) : null;

      if (projectConfig && projectConfig.id) {
        currentProjectId = String(projectConfig.id);
      }
    } catch (error) {
      projectConfig = null;
      console.error('Could not load project configuration:', error);
    }

    renderConfiguration();
  };

  const loadScenes = () => {
    try {
      const projectKey = getProjectSceneKey();
      const projectSaved = localStorage.getItem(projectKey);

      if (projectSaved !== null) {
        scenes = JSON.parse(projectSaved);
      } else {
        // Migrate scenes from the previous shared storage key.
        const legacySaved = localStorage.getItem(LEGACY_SCENE_KEY);

        if (legacySaved !== null) {
          scenes = JSON.parse(legacySaved);

          if (!Array.isArray(scenes)) {
            scenes = [];
          }

          localStorage.setItem(projectKey, JSON.stringify(scenes));
        } else {
          scenes = [];
        }
      }

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
      localStorage.setItem(
        getProjectSceneKey(),
        JSON.stringify(scenes)
      );

      return true;
    } catch (error) {
      console.error('Could not save scenes:', error);
      alert('Scenes could not be saved in this browser.');
      return false;
    }
  };

  // =========================================================
  // CONFIGURATION DISPLAY
  // =========================================================

  const renderConfiguration = () => {
    const configDisplay = document.getElementById('productionConfig');

    if (configDisplay) {
      configDisplay.textContent = projectConfig
        ? JSON.stringify(projectConfig, null, 2)
        : 'No project configuration loaded.';
    }

    const storyIdea = document.getElementById('productionStoryIdea');

    if (storyIdea) {
      storyIdea.textContent =
        projectConfig?.storyIdea ||
        projectConfig?.idea ||
        projectConfig?.prompt ||
        'No story idea saved.';
    }

    const genreDisplay = document.getElementById('productionGenres');

    if (genreDisplay) {
      const genres = projectConfig?.genres ||
        projectConfig?.genre ||
        [];

      genreDisplay.textContent = Array.isArray(genres)
        ? genres.join(', ')
        : String(genres || 'Not specified');
    }

    const projectName = document.getElementById('productionProjectName');

    if (projectName) {
      projectName.textContent =
        projectConfig?.storyIdea
          ? projectConfig.storyIdea.substring(0, 60)
          : 'Untitled Story';
    }

    const visualStyle = document.getElementById('productionVisualStyle');

    if (visualStyle) {
      visualStyle.textContent =
        projectConfig?.visualStyle || 'Not specified';
    }

    const qualityDisplay = document.getElementById('productionQuality');

    if (qualityDisplay) {
      qualityDisplay.textContent =
        projectConfig?.quality || 'Not specified';
    }

    const durationDisplay = document.getElementById('productionDuration');

    if (durationDisplay) {
      durationDisplay.textContent =
        projectConfig?.duration
          ? projectConfig.duration + ' seconds'
          : 'Not specified';
    }
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const escapeText = value => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  };

  const getFieldValue = field =>
    field ? field.value.trim() : '';

  const setFieldValue = (field, value) => {
    if (field) field.value = value ?? '';
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
    Object.values(fields).forEach(field => {
      setFieldValue(field, '');
    });

    if (emptyPanel) {
      emptyPanel.hidden = false;
    }

    if (editorForm) {
      editorForm.hidden = true;
    }
  };

  const openEditor = scene => {
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
          <button type="button"
            class="scene-select-btn"
            data-scene-select="${escapeText(scene.id)}">
            <span class="scene-card-number">SCENE ${index + 1}</span>
            <span class="scene-card-title">${escapeText(title)}</span>
            <span class="scene-card-duration">
              ${escapeText(scene.duration || '0')} sec
            </span>
          </button>

          <div class="scene-order-controls">
            <button type="button"
              data-scene-up="${escapeText(scene.id)}"
              aria-label="Move scene up"
              ${index === 0 ? 'disabled' : ''}>↑</button>

            <button type="button"
              data-scene-down="${escapeText(scene.id)}"
              aria-label="Move scene down"
              ${index === scenes.length - 1 ? 'disabled' : ''}>↓</button>
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
        <div class="timeline-scene-number">SCENE ${index + 1}</div>
        <div class="timeline-scene-title">
          ${escapeText(scene.title || 'Untitled Scene')}
        </div>
        <div class="timeline-scene-time">
          ${escapeText(scene.duration || '0')} sec
        </div>
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
      projectId: currentProjectId,
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

    if (!persistScenes()) return;

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

    scene.projectId = currentProjectId;

    if (!scene.title) {
      scene.title = 'Scene ' + getSceneNumber(scene.id);
    }

    if (!persistScenes()) return;

    renderAll();
    openEditor(scene);
  };

  // =========================================================
  // DELETE SCENE
  // =========================================================

  const deleteScene = () => {
    const scene = getScene(selectedSceneId);

    if (!scene) return;

    const confirmed = confirm(
      'Delete "' + (scene.title || 'this scene') + '"?'
    );

    if (!confirmed) return;

    scenes = scenes.filter(item => item.id !== scene.id);
    selectedSceneId = null;

    if (!persistScenes()) return;

    renderAll();
    clearEditor();
  };

  // =========================================================
  // REORDER SCENES
  // =========================================================

  const moveScene = (id, direction) => {
    const index = scenes.findIndex(scene => scene.id === id);

    if (index === -1) return;

    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= scenes.length) return;

    const temp = scenes[index];

    scenes[index] = scenes[newIndex];
    scenes[newIndex] = temp;

    if (!persistScenes()) return;

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
    sceneList.addEventListener('click', event => {
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

  const switchView = viewName => {
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
  // CONFIGURATION EXPORT
  // =========================================================

  const exportConfiguration = () => {
    const exportData = {
      project: projectConfig || {},
      projectId: currentProjectId,
      scenes: scenes,
      exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(exportData, null, 2);

    const blob = new Blob([json], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'storyforge-project-' + currentProjectId + '.json';
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportButtons = document.querySelectorAll(
    '[data-export-config], #exportConfigBtn, #exportProjectBtn'
  );

  exportButtons.forEach(button => {
    button.addEventListener('click', exportConfiguration);
  });

  // =========================================================
  // INITIALIZATION
  // =========================================================

  loadConfiguration();
  loadScenes();
  renderAll();
  clearEditor();

  try {
    const savedView = sessionStorage.getItem('storyforge_active_view');

    if (savedView) {
      switchView(savedView);
    }
  } catch (error) {
    console.warn('Could not restore previous view.');
  }

  console.log(
    'StoryForge Production Studio initialized for project:',
    currentProjectId
  );
});
        
