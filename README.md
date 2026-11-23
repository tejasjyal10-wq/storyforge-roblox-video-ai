# StoryForge Roblox Video AI (starter integration)

This is a real frontend + backend adapter for a video-generation API. It does **not** fake clips. With no provider key, `/api/generate` returns a setup-required error.

## Setup
1. Install Node.js 18+ on a server or supported hosting environment.
2. Run `npm install`.
3. Copy `.env.example` values into the hosting environment. Keep `AGNES_API_KEY` server-side and private; never put it in the HTML or send it in chat.
4. Start with `npm start`.
5. Open the server URL in a browser.

A parent/guardian should help with external account/API-key setup and any account terms, billing, or age requirements.

## API endpoints
- `GET /api/health`: status, provider key configured, model
- `POST /api/generate`: `{prompt, seconds, aspect_ratio}`
- `GET /api/jobs/:jobId`: poll generation job

## Current limits
- Real provider calls are only possible when a valid API key is configured.
- This starter uses an Agnes video API adapter; provider protocol/model availability may change. It currently sends to `POST /v1/videos` with the 2.5 Flash model and polls `/agnesapi?video_id=...&model_name=...`.
- No real generation has been tested in this package because it contains no API key.
- Single clip only; automatic multi-scene splitting, stitching, persistent storage, and reference-image consistency are not yet included.
- Jobs are held in memory and disappear if the server restarts.
- This starter has no mock video mode.
