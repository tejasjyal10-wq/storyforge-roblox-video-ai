# StoryForge v5 foundation — repair pass 2

## Preserved
- Existing v5 HTML/CSS design and local planner.
- Project, character, scene blueprint, review, and browser canvas video-export features.
- Existing backend routes and learning module.

## Added
- AI video-generation card on Studio.
- Prompt builder combining summary, scene cards, character appearance notes, dialogue, mood, camera, and duration.
- Provider health check on page initialization.
- Provider generation submission (`POST /api/generate`) and status polling (`GET /api/jobs/:jobId`).
- Safe external video link handling (HTTP/HTTPS only).
- Placeholder scene warning before prompt generation.
- Configurable CORS origin allowlist and basic security headers.
- Provider request timeout and prompt-size validation.
- Frontend static contract tests.

## Validation
- Node syntax check for inline frontend script and server.
- `npm test`: 6 tests passed.

## Not verified
- Express installation/start-up or backend HTTP smoke tests in this environment.
- Provider credentials, live video generation, external provider response compatibility, or actual video playback.
- Real-device browser interaction.
- Production security: API authentication, durable job storage, stronger rate limiting and deployment hardening are still needed.

- Saved generation job ID/status in the project and added a resume-monitor action for reopening projects while the backend is alive.
