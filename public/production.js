
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const storyConfigKey = 'storyforge_config';
  const getElement = (id) => document.getElementById(id);

  const setText = (id, value, fallback = 'Not specified') => {
    const element = getElement(id);
    if (element) {
      element.textContent = value || fallback;
    }
  };

  // =========================================================
  // WORKSPACE NAVIGATION
  // =========================================================

  const viewTitles = {
    overview: 'Overview',
    scenes: 'Scene Editor',
    characters: 'Characters',
    worlds: 'Worlds',
    audio: 'Audio Studio',
    pipeline: 'Production Pipeline',
    export: 'Export'
  };

  const navItems = document.querySelectorAll('.nav-item');
  const workspaceViews = document.querySelectorAll('.workspace-view');
  const workspaceTitle = getElement('currentWorkspaceName');

  function openView(viewName) {
    if (!viewTitles[viewName]) return;

    // Update sidebar
    navItems.forEach(item => {
      const isActive = item.dataset.view === viewName;

      item.classList.toggle('active', isActive);

      if (isActive) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });

    // Update workspace content
    workspaceViews.forEach(view => {
      const isActive = view.id === `view-${viewName}`;
      view.classList.toggle('active', isActive);
    });

    // Update page title
    if (workspaceTitle) {
      workspaceTitle.textContent = viewTitles[viewName];
    }

    // Remember active view for this session
    try {
      sessionStorage.setItem('storyforge_active_view', viewName);
    } catch (error) {
      console.warn('Could not save workspace view:', error);
    }
  }

  // Sidebar navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      openView(item.dataset.view);
    });
  });

  // Quick-access cards and buttons
  document.querySelectorAll('[data-open-view]').forEach(button => {
    button.addEventListener('click', () => {
      openView(button.dataset.openView);
    });
  });

  // Any element can open a workspace using data-view
  document.querySelectorAll('[data-navigate-view]').forEach(button => {
    button.addEventListener('click', () => {
      openView(button.dataset.navigateView);
    });
  });

  // Start on Overview, or restore the previous workspace
  let initialView = 'overview';

  try {
    const savedView = sessionStorage.getItem('storyforge_active_view');

    if (savedView && viewTitles[savedView]) {
      initialView = savedView;
    }
  } catch (error) {
    console.warn('Could not restore workspace view:', error);
  }

  openView(initialView);

  // =========================================================
  // LOAD STORY CONFIGURATION FROM STUDIO
  // =========================================================

  let config = null;

  try {
    const savedConfig = sessionStorage.getItem(storyConfigKey);

    if (savedConfig) {
      config = JSON.parse(savedConfig);
    }
  } catch (error) {
    console.error('Could not load StoryForge configuration:', error);
  }

  // =========================================================
  // NO CONFIGURATION
  // =========================================================

  if (!config) {
    setText('productionStatusTitle', 'No Story Configuration Found');
    setText(
      'productionStatusDescription',
      'Please return to Studio and configure your story first.'
    );
    setText('productionStatusBadge', 'NO CONFIG');
    setText('productionStoryIdea', 'No story has been configured yet.');
    setText('productionVisualStyle', 'Not selected');
    setText('productionDuration', 'Not selected');
    setText('productionQuality', 'Not selected');
    setText('productionCharacterMode', 'Not selected');

    setText(
      'productionCharacterDescription',
      'Choose your character settings in Studio.'
    );

    const genresContainer = getElement('productionGenres');

    if (genresContainer) {
      genresContainer.innerHTML =
        '<span class="genre-tag">No genres</span>';
    }

    // Prevent exporting an empty configuration
    const downloadButton = getElement('downloadConfigBtn');

    if (downloadButton) {
      downloadButton.disabled = true;
      downloadButton.title = 'Configure a story in Studio first.';
    }

    console.log('StoryForge Production opened without a configuration.');
    return;
  }

  // =========================================================
  // STORY IDEA
  // =========================================================

  setText(
    'productionStoryIdea',
    config.storyIdea,
    'No story idea provided.'
  );

  // =========================================================
  // GENRES
  // =========================================================

  let genres = [];

  if (Array.isArray(config.genres)) {
    genres = config.genres;
  } else if (Array.isArray(config.genre)) {
    genres = config.genre;
  } else if (
    typeof config.genre === 'string' &&
    config.genre.trim()
  ) {
    genres = config.genre.split(',');
  }

  const extraGenres =
    config.additionalGenres ||
    config.customGenres ||
    config.extraGenres ||
    '';

  if (typeof extraGenres === 'string' && extraGenres.trim()) {
    genres = genres.concat(extraGenres.split(','));
  } else if (Array.isArray(extraGenres)) {
    genres = genres.concat(extraGenres);
  }

  genres = [...new Set(
    genres
      .map(genre => String(genre).trim())
      .filter(Boolean)
  )];

  const genresContainer = getElement('productionGenres');

  if (genresContainer) {
    genresContainer.innerHTML = '';

    if (genres.length) {
      genres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = genre;
        genresContainer.appendChild(tag);
      });
    } else {
      genresContainer.innerHTML =
        '<span class="genre-tag">No genres selected</span>';
    }
  }

  // =========================================================
  // CINEMATIC SETTINGS
  // =========================================================

  setText(
    'productionVisualStyle',
    config.visualStyle,
    'Roblox Cinematic'
  );

  const durationLabels = {
    '30': '30 Seconds',
    '60': '1 Minute',
    '120': '2 Minutes',
    '180': '3 Minutes',
    '300': '5 Minutes'
  };

  const durationValue = String(config.duration || '60');

  setText(
    'productionDuration',
    durationLabels[durationValue] || `${durationValue} Seconds`
  );

  setText('productionQuality', config.quality, 'High');

  // =========================================================
  // CHARACTER CONFIGURATION
  // =========================================================

  const characterModes = {
    library: {
      title: 'Character Library',
      description: 'Use saved StoryForge characters for this story.'
    },
    new: {
      title: 'Create New Characters',
      description: 'Create new characters specifically for this adventure.'
    },
    automatic: {
      title: 'Automatic Casting',
      description: 'Characters will be determined by the story configuration.'
    }
  };

  const characterMode = characterModes[config.characterMode] || {
    title: config.characterMode || 'Not specified',
    description: 'Character configuration received from Studio.'
  };

  setText('productionCharacterMode', characterMode.title);

  setText(
    'productionCharacterDescription',
    characterMode.description
  );

  // =========================================================
  // AUDIO SETTINGS
  // =========================================================

  const audioConfig = config.audio || {};

  const updateAudio = (id, enabled) => {
    const element = getElement(id);
    if (!element) return;

    const state = element.querySelector('.audio-state');

    element.classList.toggle('audio-enabled', Boolean(enabled));

    if (state) {
      state.textContent = enabled ? 'ENABLED' : 'DISABLED';
    }
  };

  updateAudio('audioMusic', audioConfig.backgroundMusic);
  updateAudio('audioEffects', audioConfig.soundEffects);
  updateAudio('audioNarration', audioConfig.voiceNarration);
  updateAudio('audioDialogue', audioConfig.characterDialogue);

  // =========================================================
  // CONFIGURATION STATUS
  // =========================================================

  setText('productionStatusTitle', 'Configuration Received');

  setText(
    'productionStatusDescription',
    'Your story settings have been successfully loaded from Studio.'
  );

  setText('productionStatusBadge', 'CONFIGURED');

  // =========================================================
  // CONFIGURATION EXPORT
  // =========================================================

  const downloadButton = getElement('downloadConfigBtn');

  if (downloadButton) {
    downloadButton.disabled = false;

    downloadButton.addEventListener('click', () => {
      const fileContent = JSON.stringify(config, null, 2);

      const blob = new Blob([fileContent], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');

      downloadLink.href = url;
      downloadLink.download = 'storyforge-configuration.json';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  console.log('StoryForge Production configuration loaded.');
});
