---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- **Backend Architecture (BE):** NestJS v10 Modular Monolith with Domain-Driven Layering (Controller ➔ Service ➔ Core Infrastructure / Prisma ORM ➔ PostgreSQL 16).
- **Frontend Architecture (FE):** Next.js 16 App Router (React 19) with feature-driven route segments (`/organizer`, `/student`, `/judge`, `/mentor`).
- **Pure Event-Driven Automation:** Replaced DB cron polling with BullMQ Delayed Jobs backed by Redis Sorted Sets (ZSET, `score = timestamp`) for 0% DB CPU overhead during countdowns.
- **Hybrid Real-Time Delivery:** SSE (`@Sse()` + `SseProvider`) for unidirectional streaming notifications combined with Socket.IO (`AdminRealtimeGateway`) for isolated room-based WebSocket interactions (`user-${userId}`).
- **In-Place Cache Mutation:** Frontend uses `queryClient.setQueryData()` for 0ms instant countdown timer updates without triggering page reloads.
- **Zero Hardcoded Endpoints:** 100% environment URLs extracted to `.env` (`FRONTEND_URL`, `NEXT_PUBLIC_API_BASE_URL`).
