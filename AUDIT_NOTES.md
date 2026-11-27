# StoryForge audit notes (repair pass 1)

## Changes made
- Added `POST /api/storyforge` with `health`, `analyze`, and `chat` actions.
- Added deterministic local scene planning. It labels itself as a local planner and does not claim to be AI.
- Added explicit placeholder cards for stories that contain fewer than five beats rather than inventing plot events.
- Frontend now defaults to the bundled `/api/storyforge` endpoint when served by this backend.
- Backend health check is now performed from the browser health panel.
- Settings wording now distinguishes the bundled planner from a connected AI service.
- Added a dependency-free test suite for the local planner.

## Verified in this pass
- ZIP extraction and file presence were verified before this pass.
- JavaScript syntax checks: `server.js`, `storyforge-learning.js`, `storyforge-local-planner.js`, and the inline frontend script passed.
- `npm test`: 3 tests passed.

## Not verified / still open
- Express installation timed out in the current environment, so the server was not started and HTTP route integration was not exercised.
- Live AI generation is not implemented by the bundled local planner. A real provider endpoint remains a separate integration.
- Video provider generation and full end-to-end production remain unverified.
- Production CORS policy, persistent backend job storage, and deployment configuration still require review.
- This ZIP is a snapshot of files available to the audit, not guaranteed to be a complete export of the current GitHub repository.

## v4 video review workspace additions
- Added a dedicated responsive Video Review & Quality Control page with themed animated panels and a canvas preview.
- Added a 10-point verification flow that runs sequentially and reports actual local validation/backend checks as Passed, Warning, or Failed; results are saved to the current project.
- Added project-scoped rating and written feedback records, scene selection, and local persistence.
- Added revision request records for whole-project or scene-specific improvement notes, plus JSON export of review notes. Requests are explicitly not treated as video regeneration because no connected regeneration provider is available.
- Added a review-page video export entry point with a bounded maximum of 15 status observations. It monitors the existing browser-rendered export status and does not simulate completion or cancel rendering.
- These features have not been browser-interaction tested in a real device. Backend connectivity, AI generation, and actual video provider regeneration remain unverified/unconnected.
- Headless Chromium smoke-test attempt timed out in the available environment; interactive browser testing is still pending. This package has passed static syntax checks and automated Node tests.


## Repair pass 2 (2026-11-27)
- Added a provider video generation panel to Studio, connected to the existing backend generation and job-status endpoints.
- Added prompt assembly from story summary, scene cards, camera/mood/dialogue, and saved character appearance notes. The resulting prompt remains editable before submission.
- Provider monitoring uses up to 15 status checks spaced 5 seconds apart in the UI; the provider job may continue after the UI monitoring limit.
- Added restrictive configurable CORS allowlist defaults for local origins, basic security headers, a 90-second provider request timeout, and a 12,000-character prompt cap.
- Added frontend contract tests for inline click handlers, provider generation integration, and duplicate element IDs.
- Still not verified: provider credentials, live provider generation, completed external video, and interactive browser behavior on real devices. Provider generation may fail if the selected provider/API configuration is incompatible.

- Saved provider job IDs/status in the active project and added a resume-monitor action for reopened projects. Backend jobs are still memory-only and disappear on server restart.
