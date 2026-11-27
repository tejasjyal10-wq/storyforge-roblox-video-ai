'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const CONFIG_STORAGE_KEY = 'storyforge_config';
  const LEGACY_SCENE_KEY = 'storyforge_production_scenes';
  const PROJECT_SCENE_PREFIX = 'storyforge_production_scenes_';

  let projectConfig = null;
  let currentProjectId = 'default_project';
  let scenes = [];
  let selectedSceneId = null;
  let currentView = 'overview';

  const $ = (id) => document.getElementById(id);

  const editorForm = $('sceneEditorForm');
  const sceneList = $('sceneList');
  const sceneTimeline = $('sceneTimeline');

  const editorFields = {
    title: $('sceneTitleInput'),
    description: $('sceneDescriptionInput'),
    location: $('sceneLocationInput'),
    characters: $('sceneCharactersInput'),
    action: $('sceneActionInput'),
    dialogue: $('sceneDialogueInput'),
    duration: $('sceneDurationInput'),
    camera: $('sceneCameraInput'),
    animation: $('sceneAnimationInput'),
    notes: $('sceneNotesInput')
  };

  function safeParse(value, fallback = null) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getProjectName() {
    return projectConfig?.projectName ||
      projectConfig?.title ||
      projectConfig?.name ||
      'My Story Project';
  }

  function getStoryIdea() {
    return projectConfig?.storyIdea ||
      projectConfig?.story ||
      projectConfig?.idea ||
      projectConfig?.description ||
      '';
  }

  function getGenres() {
    const genres = projectConfig?.genres ||
      projectConfig?.genre ||
      [];

    if (Array.isArray(genres)) {
      return genres;
    }

    if (typeof genres === 'string') {
      return genres
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function getVisualStyle() {
    return projectConfig?.visualStyle ||
      projectConfig?.style ||
      'Roblox Cinematic';
  }

  function getQuality() {
    return projectConfig?.quality ||
      projectConfig?.videoQuality ||
      'Standard';
  }

  function getTargetDuration() {
    return Number(
      projectConfig?.duration ||
      projectConfig?.videoDuration ||
      projectConfig?.targetDuration ||
      60
    );
  }

  function getCharacterMode() {
    return projectConfig?.characterMode ||
      projectConfig?.charactersMode ||
      'library';
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes === 0) {
      return `${remainingSeconds} sec`;
    }

    if (remainingSeconds === 0) {
      return `${minutes} min`;
    }

    return `${minutes} min ${remainingSeconds} sec`;
  }

  function getTotalSceneDuration() {
    return scenes.reduce((total, scene) => {
      return total + (Number(scene.duration) || 0);
    }, 0);
  }

  function getProjectSceneStorageKey() {
    return PROJECT_SCENE_PREFIX + currentProjectId;
  }

  // -----------------------------------------
  // CONFIGURATION
  // -----------------------------------------

  function loadConfiguration() {
    const savedConfig = sessionStorage.getItem(CONFIG_STORAGE_KEY);

    projectConfig = savedConfig
      ? safeParse(savedConfig, null)
      : null;

    if (projectConfig) {
      currentProjectId =
        projectConfig.id ||
        projectConfig.projectId ||
        'default_project';
    }
  }

  function renderConfiguration() {
    if (!projectConfig) {
      return;
    }

    const projectName = getProjectName();
    const storyIdea = getStoryIdea();
    const genres = getGenres();
    const visualStyle = getVisualStyle();
    const quality = getQuality();
    const targetDuration = getTargetDuration();
    const characterMode = getCharacterMode();

    // Project name
    const projectNameElements = document.querySelectorAll(
      '.sidebar-project .project-name, #projectName, #productionProjectName'
    );

    projectNameElements.forEach(element => {
      element.textContent = projectName;
    });

    // Story description
    const storyElement = $('productionStoryIdea');

    if (storyElement) {
      storyElement.textContent = storyIdea || 'No story idea provided.';
    }

    // Genre tags
    const genreContainer = $('productionGenres');

    if (genreContainer) {
      genreContainer.replaceChildren();

      genres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = genre;
        genreContainer.appendChild(tag);
      });

      if (genres.length === 0) {
        genreContainer.textContent = 'No genres selected';
      }
    }

    // Visual style
    const visualStyleElements = [
      $('productionVisualStyle'),
      $('overviewVisualStyle')
    ];

    visualStyleElements.forEach(element => {
      if (element) {
        element.textContent = visualStyle;
      }
    });

    // Quality
    const qualityElement = $('productionQuality');

    if (qualityElement) {
      qualityElement.textContent = quality;
    }

    // Target duration
    const durationElement = $('productionDuration');

    if (durationElement) {
      durationElement.textContent = formatDuration(targetDuration);
    }

    // Character mode
    const characterModeLabel = getCharacterModeLabel(characterMode);

    const characterModeElements = [
      $('productionCharacterMode'),
      $('characterWorkspaceMode')
    ];

    characterModeElements.forEach(element => {
      if (element) {
        element.textContent = characterModeLabel;
      }
    });

    const characterDescription = $('productionCharacterDescription');

    if (characterDescription) {
      characterDescription.textContent =
        getCharacterModeDescription(characterMode);
    }

    // Story preview description
    const previewDescription = $('videoPreviewDescription');

    if (previewDescription) {
      if (scenes.length === 0) {
        previewDescription.textContent =
          'Your story is configured. Add scenes to begin preparing your video.';
      } else {
        previewDescription.textContent =
          `${scenes.length} scene(s) planned. ` +
          'Video generation will be available when the rendering system is connected.';
      }
    }

    // Optional project JSON display
    const configDisplay = $('productionConfig');

    if (configDisplay) {
      configDisplay.textContent = JSON.stringify(
        projectConfig,
        null,
        2
      );
    }
  }

  function getCharacterModeLabel(mode) {
    const normalized = String(mode).toLowerCase();

    if (normalized === 'library') {
      return 'Character Library';
    }

    if (normalized === 'create') {
      return 'Create Characters';
    }

    if (normalized === 'custom') {
      return 'Custom Characters';
    }

    return mode || 'Character Library';
  }

  function getCharacterModeDescription(mode) {
    const normalized = String(mode).toLowerCase();

    if (normalized === 'library') {
      return 'Use saved characters from your Character Library.';
    }

    if (normalized === 'create') {
      return 'Create characters for your story.';
    }

    if (normalized === 'custom') {
      return 'Use your own custom character setup.';
    }

    return 'Your selected character workflow.';
  }

  // -----------------------------------------
  // SCENE STORAGE
  // -----------------------------------------

  function loadScenes() {
    let storedScenes = localStorage.getItem(
      getProjectSceneStorageKey()
    );

    // Migrate old single-project scene storage
    if (!storedScenes) {
      const legacyScenes = localStorage.getItem(LEGACY_SCENE_KEY);

      if (legacyScenes) {
        storedScenes = legacyScenes;

        localStorage.setItem(
          getProjectSceneStorageKey(),
          legacyScenes
        );
      }
    }

    const parsedScenes = safeParse(storedScenes, []);

    scenes = Array.isArray(parsedScenes)
      ? parsedScenes
      : [];

    scenes = scenes.map((scene, index) => ({
      ...scene,
      id: scene.id || `scene_${Date.now()}_${index}`,
      projectId: currentProjectId,
      order: Number.isFinite(Number(scene.order))
        ? Number(scene.order)
        : index
    }));

    scenes.sort((a, b) => a.order - b.order);
  }

  function persistScenes() {
    try {
      scenes.forEach((scene, index) => {
        scene.order = index;
        scene.projectId = currentProjectId;
      });

      localStorage.setItem(
        getProjectSceneStorageKey(),
        JSON.stringify(scenes)
      );

      return true;
    } catch (error) {
      console.error('Unable to save scenes:', error);

      alert(
        'Unable to save scenes. Your browser storage may be full.'
      );

      return false;
    }
  }

  // -----------------------------------------
  // DASHBOARD
  // -----------------------------------------

  function updateDashboard() {
    const sceneCount = scenes.length;
    const totalDuration = getTotalSceneDuration();

    // Scene count
    const sceneCountElement = $('sceneCount');

    if (sceneCountElement) {
      sceneCountElement.textContent =
        `${sceneCount} ${sceneCount === 1 ? 'Scene' : 'Scenes'}`;
    }

    const sceneEditorCount = $('sceneEditorCount');

    if (sceneEditorCount) {
      sceneEditorCount.textContent =
        `${sceneCount} scene(s) in your story`;
    }

    // Optional total scene duration
    const totalDurationElement = $('totalSceneDuration');

    if (totalDurationElement) {
      totalDurationElement.textContent =
        formatDuration(totalDuration);
    }

    // Project status
    const statusTitle = $('productionStatusTitle');

    let statusText = 'Draft';

    if (projectConfig) {
      statusText = sceneCount > 0
        ? 'Scenes Planned'
        : 'Configured';
    }

    if (statusTitle) {
      statusTitle.textContent = statusText;
    }

    const sidebarStatus = document.querySelector(
      '.sidebar-project .project-status'
    );

    if (sidebarStatus) {
      sidebarStatus.textContent = statusText;
    }

    // Audio settings
    updateAudioStatus();

    // Video preview status
    const previewDescription = $('videoPreviewDescription');

    if (previewDescription) {
      if (sceneCount === 0) {
        previewDescription.textContent =
          'Your story is configured. Add scenes to begin preparing your preview.';
      } else {
        previewDescription.textContent =
          `${sceneCount} scene(s) planned. ` +
          'The preview is not rendered yet.';
      }
    }
  }

  function updateAudioStatus() {
    const audioConfig = projectConfig?.audio || {};

    const audioItems = [
      {
        id: 'audioMusic',
        keys: ['music', 'backgroundMusic']
      },
      {
        id: 'audioEffects',
        keys: ['effects', 'soundEffects']
      },
      {
        id: 'audioNarration',
        keys: ['narration', 'voiceover']
      },
      {
        id: 'audioDialogue',
        keys: ['dialogue', 'characterDialogue']
      }
    ];

    audioItems.forEach(item => {
      const element = $(item.id);

      if (!element) {
        return;
      }

      let enabled = false;

      for (const key of item.keys) {
        if (typeof audioConfig[key] === 'boolean') {
          enabled = audioConfig[key];
          break;
        }
      }

      const statusElement = element.querySelector('.audio-state');

      if (statusElement) {
        statusElement.textContent = enabled
          ? 'Enabled'
          : 'Disabled';

        statusElement.classList.toggle('enabled', enabled);
        statusElement.classList.toggle('disabled', !enabled);
      }
    });
  }

  // -----------------------------------------
  // SCENE LIST
  // -----------------------------------------

  function renderSceneList() {
    if (!sceneList) {
      return;
    }

    sceneList.replaceChildren();

    if (scenes.length === 0) {
      const emptyMessage = document.createElement('div');

      emptyMessage.className = 'scene-empty-message';
      emptyMessage.textContent =
        'No scenes yet. Add your first scene to start building your story.';

      sceneList.appendChild(emptyMessage);
      return;
    }

    scenes.forEach((scene, index) => {
      const item = document.createElement('div');

      item.className = 'scene-list-item';

      if (scene.id === selectedSceneId) {
        item.classList.add('active');
      }

      item.dataset.sceneId = scene.id;

      const sceneButton = document.createElement('button');

      sceneButton.type = 'button';
      sceneButton.className = 'scene-select-button';
      sceneButton.dataset.sceneId = scene.id;

      const title = document.createElement('span');

      title.className = 'scene-list-title';
      title.textContent = scene.title || `Scene ${index + 1}`;

      const subtitle = document.createElement('span');

      subtitle.className = 'scene-list-subtitle';
        subtitle.textContent =
        `${formatDuration(scene.duration)} · ` +
        `${scene.location || 'Location not set'}`;

      sceneButton.appendChild(title);
      sceneButton.appendChild(subtitle);

      const controls = document.createElement('div');

      controls.className = 'scene-order-controls';

      const upButton = createOrderButton(
        '↑',
        'Move scene up',
        index === 0,
        scene.id,
        'up'
      );

      const downButton = createOrderButton(
        '↓',
        'Move scene down',
        index === scenes.length - 1,
        scene.id,
        'down'
      );

      controls.appendChild(upButton);
      controls.appendChild(downButton);

      item.appendChild(sceneButton);
      item.appendChild(controls);

      sceneList.appendChild(item);
    });
  }

  function createOrderButton(
    text,
    label,
    disabled,
    sceneId,
    direction
  ) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = text;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.dataset.moveScene = sceneId;
    button.dataset.direction = direction;

    return button;
  }

  // -----------------------------------------
  // TIMELINE
  // -----------------------------------------

  function renderTimeline() {
    if (!sceneTimeline) {
      return;
    }

    sceneTimeline.replaceChildren();

    if (scenes.length === 0) {
      const empty = document.createElement('div');

      empty.className = 'timeline-empty';
      empty.textContent = 'Your scene timeline will appear here.';

      sceneTimeline.appendChild(empty);
      return;
    }

    scenes.forEach((scene, index) => {
      const item = document.createElement('div');

      item.className = 'timeline-scene';

      if (scene.id === selectedSceneId) {
        item.classList.add('active');
      }

      item.dataset.sceneId = scene.id;

      const sceneTitle = document.createElement('div');

      sceneTitle.className = 'timeline-scene-title';
      sceneTitle.textContent = scene.title || `Scene ${index + 1}`;

      const duration = document.createElement('div');

      duration.className = 'timeline-scene-duration';
      duration.textContent = formatDuration(scene.duration);

      item.appendChild(sceneTitle);
      item.appendChild(duration);

      sceneTimeline.appendChild(item);
    });
  }

  // -----------------------------------------
  // EDITOR
  // -----------------------------------------

  function collectEditorData() {
    return {
      title: editorFields.title?.value.trim() || '',
      description: editorFields.description?.value.trim() || '',
      location: editorFields.location?.value.trim() || '',
      characters: editorFields.characters?.value.trim() || '',
      action: editorFields.action?.value.trim() || '',
      dialogue: editorFields.dialogue?.value.trim() || '',
      duration: Math.max(
        1,
        Number(editorFields.duration?.value) || 30
      ),
      camera: editorFields.camera?.value.trim() || '',
      animation: editorFields.animation?.value.trim() || '',
      notes: editorFields.notes?.value.trim() || ''
    };
  }

  function fillEditor(scene) {
    if (!scene) {
      return;
    }

    Object.entries(editorFields).forEach(([key, element]) => {
      if (element) {
        element.value = scene[key] ?? '';
      }
    });

    if ($('sceneDetailHeading')) {
      $('sceneDetailHeading').textContent =
        scene.title || 'Edit Scene';
    }

    if ($('sceneEditorHeading')) {
      $('sceneEditorHeading').textContent =
        'Scene Editor';
    }

    if ($('sceneDetailEmpty')) {
      $('sceneDetailEmpty').hidden = true;
    }

    if (editorForm) {
      editorForm.hidden = false;
    }

    if ($('deleteSceneBtn')) {
      $('deleteSceneBtn').hidden = false;
    }
  }

  function clearEditor() {
    selectedSceneId = null;

    Object.values(editorFields).forEach(element => {
      if (element) {
        element.value = '';
      }
    });

    if ($('sceneDetailHeading')) {
      $('sceneDetailHeading').textContent = 'Scene Details';
    }

    if ($('sceneDetailEmpty')) {
      $('sceneDetailEmpty').hidden = false;
    }

    if (editorForm) {
      editorForm.hidden = true;
    }

    if ($('deleteSceneBtn')) {
      $('deleteSceneBtn').hidden = true;
    }

    renderSceneList();
    renderTimeline();
  }

  function openSceneEditor(sceneId) {
    const scene = scenes.find(item => item.id === sceneId);

    if (!scene) {
      return;
    }

    selectedSceneId = sceneId;

    fillEditor(scene);
    renderSceneList();
    renderTimeline();
  }

  function addScene() {
    const newScene = {
      id: `scene_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      projectId: currentProjectId,
      order: scenes.length,
      title: `Scene ${scenes.length + 1}`,
      description: '',
      location: '',
      characters: '',
      action: '',
      dialogue: '',
      duration: 30,
      camera: '',
      animation: '',
      notes: ''
    };

    scenes.push(newScene);

    if (!persistScenes()) {
      scenes.pop();
      return;
    }

    renderAll();
    openSceneEditor(newScene.id);
  }

  function saveScene() {
    if (!selectedSceneId) {
      return;
    }

    const scene = scenes.find(item => item.id === selectedSceneId);

    if (!scene) {
      return;
    }

    const updatedData = collectEditorData();

    Object.assign(scene, updatedData);

    if (!scene.title) {
      scene.title = `Scene ${scenes.indexOf(scene) + 1}`;
    }

    if (!persistScenes()) {
      return;
    }

    renderAll();
    openSceneEditor(scene.id);
  }

  function deleteScene() {
    if (!selectedSceneId) {
      return;
    }

    const confirmed = confirm(
      'Are you sure you want to delete this scene?'
    );

    if (!confirmed) {
      return;
    }

    const previousScenes = [...scenes];

    scenes = scenes.filter(
      scene => scene.id !== selectedSceneId
    );

    if (!persistScenes()) {
      scenes = previousScenes;
      return;
    }

    clearEditor();
    renderAll();
  }

  function moveScene(sceneId, direction) {
    const index = scenes.findIndex(
      scene => scene.id === sceneId
    );

    if (index < 0) {
      return;
    }

    const newIndex = direction === 'up'
      ? index - 1
      : index + 1;

    if (newIndex < 0 || newIndex >= scenes.length) {
      return;
    }

    const previousScenes = [...scenes];

    [scenes[index], scenes[newIndex]] =
      [scenes[newIndex], scenes[index]];

    if (!persistScenes()) {
      scenes = previousScenes;
      return;
    }

    renderAll();

    if (selectedSceneId) {
      openSceneEditor(selectedSceneId);
    }
  }

  // -----------------------------------------
  // NAVIGATION
  // -----------------------------------------

  function switchView(viewName) {
    if (!viewName) return;

    currentView = viewName;

    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.view === viewName
      );
    });

    document.querySelectorAll('.workspace-view').forEach(view => {
      view.classList.toggle(
        'active',
        view.id === `view-${viewName}`
      );
    });

    const workspaceTitle = $('currentWorkspaceName');

    if (workspaceTitle) {
      const viewNames = {
        overview: 'Overview',
        scenes: 'Scenes',
        characters: 'Characters',
        worlds: 'Worlds',
        audio: 'Audio',
        pipeline: 'Pipeline',
        export: 'Export'
      };

      workspaceTitle.textContent =
        viewNames[viewName] || viewName;
    }

    sessionStorage.setItem(
      'storyforge_production_view',
      currentView
    );
  }

  // -----------------------------------------
  // EXPORT
  // -----------------------------------------

  function exportConfiguration() {
    const exportData = {
      project: projectConfig,
      scenes: scenes,
      exportedAt: new Date().toISOString(),
      projectId: currentProjectId
    };

    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `${getProjectName().replace(/[^a-z0-9]/gi, '_')}_storyforge.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  // -----------------------------------------
  // RENDER
  // -----------------------------------------

  function renderAll() {
    renderConfiguration();
    renderSceneList();
    renderTimeline();
    updateDashboard();
  }

  // -----------------------------------------
  // EVENT LISTENERS
  // -----------------------------------------

  const addSceneButton = $('addSceneBtn');

  if (addSceneButton) {
    addSceneButton.addEventListener('click', addScene);
  }

  // Prevent form reload when saving a scene
  if (editorForm) {
    editorForm.addEventListener('submit', event => {
      event.preventDefault();
      saveScene();
    });
  }

  const deleteSceneButton = $('deleteSceneBtn');

  if (deleteSceneButton) {
    deleteSceneButton.addEventListener(
      'click',
      deleteScene
    );
  }

  if (sceneList) {
    sceneList.addEventListener('click', event => {
      const moveButton = event.target.closest(
        '[data-move-scene]'
      );

      if (moveButton) {
        moveScene(
          moveButton.dataset.moveScene,
          moveButton.dataset.direction
        );
        return;
      }

      const sceneButton = event.target.closest(
        '[data-scene-id]'
      );

      if (sceneButton) {
        openSceneEditor(sceneButton.dataset.sceneId);
      }
    });
  }

  if (sceneTimeline) {
    sceneTimeline.addEventListener('click', event => {
      const sceneElement = event.target.closest(
        '[data-scene-id]'
      );

      if (sceneElement) {
        openSceneEditor(sceneElement.dataset.sceneId);
      }
    });
  }

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');

    if (viewButton) {
      switchView(viewButton.dataset.view);
      return;
    }

    const openViewButton = event.target.closest(
      '[data-open-view], [data-navigate-view]'
    );

    if (openViewButton) {
      const view =
        openViewButton.dataset.openView ||
        openViewButton.dataset.navigateView;

      switchView(view);
    }
  });

  document.querySelectorAll(
    '[data-export-config], #exportConfigBtn, #exportProjectBtn'
  ).forEach(button => {
    button.addEventListener(
      'click',
      exportConfiguration
    );
  });

  // -----------------------------------------
  // INITIALIZATION
  // -----------------------------------------

  loadConfiguration();
  loadScenes();

  renderAll();
  clearEditor();

  const savedView = sessionStorage.getItem(
    'storyforge_production_view'
  );

  switchView(savedView || 'overview');
});
