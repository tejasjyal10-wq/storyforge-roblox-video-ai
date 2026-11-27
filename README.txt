StoryForge Production prompt-to-scene integration update

Replace the three existing Production workspace files with these files:
- production.js (updated: Generate Scenes click handler calls /api/story-director/plan, maps returned plan to editable scenes, persists scenes for current project)
- production.html (included unchanged: already contains the prompt UI, duration input, button, and status element)
- production.css (included unchanged: already styles the generator UI)

Backend prerequisites already present in the reviewed server files:
- server.js mounts /api/story-director
- storyforge-story-director.js exposes POST /api/story-director/plan
- Configure STORYFORGE_LLM_API_KEY in the server environment before real AI generation can work.

Tests performed: node syntax check; Story Director helper unit checks; static wiring checks for prompt UI, CSS, API path, event handler, and persistence.
Live provider generation was not tested because the API key is not available in this session.
