document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("studioForm");
  const storyIdea = document.getElementById("storyIdea");
  const characterCount = document.getElementById("characterCount");
  const createStoryBtn = document.getElementById("createStoryBtn");

  const DRAFT_KEY = "storyforge_studio_draft";
  const CONFIG_KEY = "storyforge_config";

  if (!form) return;

  // -----------------------------------------
  // GET FORM VALUES
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
    if (!storyIdea || !characterCount) return;

    const count = storyIdea.value.length;

    characterCount.textContent = `${count} characters`;
  }

  // -----------------------------------------
  // SAVE STUDIO DRAFT
  // -----------------------------------------

  function getStudioDraft() {
    return {
      storyIdea: storyIdea.value,

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

  function saveDraft() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(getStudioDraft())
      );
    } catch (error) {
      console.warn("Could not save Studio draft:", error);
    }
  }

  // -----------------------------------------
  // RESTORE PREVIOUS STUDIO SETTINGS
  // -----------------------------------------

  function restoreDraft() {
    let draft;

    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    } catch (error) {
      console.warn("Could not restore Studio draft:", error);
      return;
    }

    if (!draft) return;

    if (storyIdea && typeof draft.storyIdea === "string") {
      storyIdea.value = draft.storyIdea;
    }

    if (draft.genre) {
      const genreRadio = form.querySelector(
        `input[name="genre"][value="${CSS.escape(draft.genre)}"]`
      );

      if (genreRadio) genreRadio.checked = true;
    }

    const customGenres = document.getElementById("customGenres");

    if (customGenres && typeof draft.customGenres === "string") {
      customGenres.value = draft.customGenres;
    }

    if (draft.characterMode) {
      const characterRadio = form.querySelector(
        `input[name="characterMode"][value="${CSS.escape(draft.characterMode)}"]`
      );

      if (characterRadio) characterRadio.checked = true;
    }

    if (draft.visualStyle) {
      document.getElementById("visualStyle").value = draft.visualStyle;
    }

    if (draft.duration) {
      document.getElementById("duration").value = draft.duration;
    }

    if (draft.quality) {
      document.getElementById("quality").value = draft.quality;
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

      if (checkbox && typeof draft[name] === "boolean") {
        checkbox.checked = draft[name];
      }
    });

    updateCharacterCount();
  }

  // -----------------------------------------
  // AUTO-SAVE WHEN ANYTHING CHANGES
  // -----------------------------------------

  form.addEventListener("input", () => {
    updateCharacterCount();
    saveDraft();
  });

  form.addEventListener("change", saveDraft);

  // Restore before saving any new draft.
  restoreDraft();
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

    // Save the complete configuration for Production.
    try {
      sessionStorage.setItem(
        CONFIG_KEY,
        JSON.stringify(configuration)
      );

      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(getStudioDraft())
      );
    } catch (error) {
      console.error("Could not save story configuration:", error);
      alert("Unable to save your story. Please try again.");
      return;
    }

    // Prevent accidental double-clicking.
    createStoryBtn.disabled = true;
    createStoryBtn.style.opacity = "0.7";

    const buttonText = createStoryBtn.querySelector("span");

    if (buttonText) {
      buttonText.textContent = "OPENING PRODUCTION...";
    }

    // Go to the Production page.
    window.location.href = "/production.html";
  });

  console.log("StoryForge Studio initialized successfully.");
});

