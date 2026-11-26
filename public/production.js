'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const storyConfigKey = 'storyforge_config';

  // Read the configuration saved by Studio
  let config = null;

  try {
    const savedConfig = sessionStorage.getItem(storyConfigKey);

    if (savedConfig) {
      config = JSON.parse(savedConfig);
    }
  } catch (error) {
    console.error('Could not load StoryForge configuration:', error);
  }

  const getElement = (id) => document.getElementById(id);

  const setText = (id, value, fallback = 'Not specified') => {
    const element = getElement(id);
    if (element) {
      element.textContent = value || fallback;
    }
  };

  // No configuration found
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
      genresContainer.innerHTML = '<span class="genre-tag">No genres</span>';
    }

    return;
  }

  // STORY IDEA
  setText(
    'productionStoryIdea',
    config.storyIdea,
    'No story idea provided.'
  );

  // GENRES: support single genre, multiple genres,
  // and additional typed genres.
  let genres = [];

  if (Array.isArray(config.genres)) {
    genres = config.genres;
  } else if (Array.isArray(config.genre)) {
    genres = config.genre;
  } else if (typeof config.genre === 'string' && config.genre.trim()) {
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

  // CINEMATIC SETTINGS
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

  setText(
    'productionQuality',
    config.quality,
    'High'
  );

  // CHARACTER CONFIGURATION
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

  // AUDIO SETTINGS
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

  // STATUS
  setText('productionStatusTitle', 'Configuration Received');
  setText(
    'productionStatusDescription',
    'Your story settings have been successfully loaded from Studio.'
  );
  setText('productionStatusBadge', 'CONFIGURED');

  // CONFIGURATION EXPORT
  const downloadButton = getElement('downloadConfigBtn');

  if (downloadButton) {
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

      URL.revokeObjectURL(url);
    });
  }

  console.log('StoryForge Production configuration loaded.');
});
                          
