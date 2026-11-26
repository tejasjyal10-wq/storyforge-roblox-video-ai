
'use strict';

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("studioForm");
  const storyIdea = document.getElementById("storyIdea");
  const characterCount = document.getElementById("characterCount");
  const createStoryBtn = document.getElementById("createStoryBtn");

  const DRAFT_KEY = "storyforge_studio_settings";
  const CONFIG_KEY = "storyforge_config";

  if (!form || !storyIdea || !createStoryBtn) return;

  // -----------------------------------------
  // FORM HELPERS
  // -----------------------------------------

  function getSelectedValue(name, fallback = "") {
    const selected = form.querySelector(
      `input[name="${name}"]:checked`
    );

    return selected ? selected.value : fallback;
  }

  function getChecked(name) {
    const checkbox = form.querySelector(
      `input[name="${name}"]`
    );

    return checkbox ? checkbox.checked : false;
  }

  function getGenres() {
    const mainGenre = getSelectedValue("genre", "Adventure");
    const customInput = document.getElementById("customGenres");

    const extraGenres = customInput
      ? customInput.value
          .split(",")
          .map(genre => genre.trim())
          .filter(Boolean)
      : [];

    return [...new Set([mainGenre, ...extraGenres])];
  }

  // -----------------------------------------
  // CHARACTER COUNTER
  // -----------------------------------------

  function updateCharacterCount() {
    characterCount.textContent =
      `${storyIdea.value.length} characters`;
  }

  // -----------------------------------------
  // SAVE SETTINGS ONLY
  // The story prompt is NOT saved as a draft.
  // -----------------------------------------

  function getStudioSettings() {
    return {
      genre: getSelectedValue("genre", "Adventure"),

      customGenres:
        document.getElementById("customGenres")?.value || "",

      characterMode:
        getSelectedValue("characterMode", "library"),

      visualStyle:
        document.getElementById("visualStyle")?.value ||
        "Roblox Cinematic",

      duration:
        document.getElementById("duration")?.value || "60",

      quality:
        document.getElementById("quality")?.value || "High",

      backgroundMusic: getChecked("backgroundMusic"),
      soundEffects: getChecked("soundEffects"),
      voiceNarration: getChecked("voiceNarration"),
      characterDialogue: getChecked("characterDialogue")
    };
  }

  function saveSettings() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(getStudioSettings())
      );
    } catch (error) {
      console.warn("Could not save Studio settings:", error);
    }
  }

  // -----------------------------------------
  // RESTORE SETTINGS
  // Never restore an old story prompt.
  // -----------------------------------------

  function restoreSettings() {
    let settings;

    try {
      settings = JSON.parse(localStorage.getItem(DRAFT_KEY));
    } catch (error) {
      console.warn("Could not restore Studio settings:", error);
      return;
    }

    // Always start with a blank story prompt.
    storyIdea.value = "";

    if (!settings) {
      updateCharacterCount();
      return;
    }

    if (settings.genre) {
      const genreRadio = form.querySelector(
        `input[name="genre"][value="${CSS.escape(settings.genre)}"]`
      );

      if (genreRadio) genreRadio.checked = true;
    }

    const customGenres = document.getElementById("customGenres");

    if (customGenres && typeof settings.customGenres === "string") {
      customGenres.value = settings.customGenres;
    }

    if (settings.characterMode) {
      const characterRadio = form.querySelector(
        `input[name="characterMode"][value="${CSS.escape(settings.characterMode)}"]`
      );

      if (characterRadio) characterRadio.checked = true;
    }

    if (settings.visualStyle) {
      document.getElementById("visualStyle").value =
        settings.visualStyle;
    }

    if (settings.duration) {
      document.getElementById("duration").value =
        settings.duration;
    }

    if (settings.quality) {
      document.getElementById("quality").value =
        settings.quality;
    }

    const audioSettings = [
      "backgroundMusic",
      "soundEffects",
      "voiceNarration",
      "characterDialogue"
    ];

    audioSettings.forEach(name => {
      const checkbox = form.querySelector(
        `input[name="${name}"]`
      );

      if (checkbox && typeof settings[name] === "boolean") {
        checkbox.checked = settings[name];
      }
    });

    updateCharacterCount();
  }

  // -----------------------------------------
  // AUTO-SAVE SETTINGS
  // Prompt text is deliberately excluded.
  // -----------------------------------------

  form.addEventListener("input", () => {
    updateCharacterCount();
    saveSettings();
  });

  form.addEventListener("change", saveSettings);

  // -----------------------------------------
  // INITIALIZE
  // -----------------------------------------

  restoreSettings();
  updateCharacterCount();

  // -----------------------------------------
  // BUILD STORY CONFIGURATION
  // -----------------------------------------

  form.addEventListener("submit", event => {
    event.preventDefault();

    const idea = storyIdea.value.trim();

    if (!idea) {
      storyIdea.focus();
      alert("Please enter your story idea first.");
      return;
    }

    const configuration = {
      id: "story_" + Date.now(),

      storyIdea: idea,

      genres: getGenres(),

      mainGenre: getSelectedValue("genre", "Adventure"),

      customGenres:
        document.getElementById("customGenres")?.value || "",

      characterMode:
        getSelectedValue("characterMode", "library"),

      visualStyle:
        document.getElementById("visualStyle").value,

      duration: Number(
        document.getElementById("duration").value
      ),

      quality:
        document.getElementById("quality").value,

      audio: {
        backgroundMusic: getChecked("backgroundMusic"),
        soundEffects: getChecked("soundEffects"),
        voiceNarration: getChecked("voiceNarration"),
        characterDialogue: getChecked("characterDialogue")
      },

      createdAt: new Date().toISOString(),

      status: "ready"
    };

    // Save the current story for Production.
    try {
      sessionStorage.setItem(
        CONFIG_KEY,
        JSON.stringify(configuration)
      );
    } catch (error) {
      console.error("Could not save story configuration:", error);
      alert("Unable to save your story. Please try again.");
      return;
    }

    // Save settings, but never save the prompt.
    saveSettings();

    // Prevent accidental double-clicks.
    createStoryBtn.disabled = true;
    createStoryBtn.style.opacity = "0.7";

    const buttonText = createStoryBtn.querySelector("span");

    if (buttonText) {
      buttonText.textContent = "OPENING PRODUCTION...";
    }

    // Open Production.
    window.location.href = "/production.html";
  });

  console.log("StoryForge Studio initialized successfully.");
});
