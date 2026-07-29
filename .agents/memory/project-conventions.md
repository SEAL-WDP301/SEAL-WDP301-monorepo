---
type: project
created: 2026-05-25
updated: 2026-07-12
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.
- Separate git commits by feature/module (`feat(realtime)`, `feat(round)`, `fix(round)`, `docs(readme)`).

## SEAL Project Conventions
- **Past-Date Validation:** Frontend deadline picker must enforce HTML5 `min` attribute matching `now` and block past-date deadline selection with user warnings.
- **Dynamic Endpoints:** All API and WebSocket base URLs must be resolved dynamically via environment variables (`ConfigService` in NestJS, `process.env.NEXT_PUBLIC_*` in Next.js).
- **Zero Sentry Dependencies:** Sentry packages and configuration files (`instrument.*`) are completely removed in favor of Winston Logger and custom `AllExceptionsFilter`.
- **Public Assets:** All logo and brand identity images must be stored in `FE/public/brand/` (no temporary `tmp/imagegen` folders).

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.
