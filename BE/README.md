# 🛡️ SEAL – Hackathon Management Platform (Backend Engine)

[![NestJS](https://img.shields.io/badge/NestJS-v10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-6.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-v7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5.x-E10098?logo=bullmq&logoColor=white)](https://bullmq.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-ready, high-concurrency **Backend API Engine** for **SEAL** (Software Engineering & AI-driven Hackathon Management Platform). Built with NestJS, Prisma ORM, Redis, BullMQ, Socket.IO, and Server-Sent Events (SSE), this system automates end-to-end academic and software hackathons—from GitHub repository provisioning and multi-channel notification dispatching to multi-judge rubric scoring and research-grade Inter-Rater Reliability analysis.

---

## 📌 Project Overview & Value Proposition

Organizing academic and software engineering hackathons involves significant operational complexity: managing team registrations, provisioning GitHub repositories, enforcing strict submission deadlines, routing mentor/judge feedback, and evaluating projects fairly across multiple rubric criteria.

**SEAL** digitizes and automates this entire lifecycle through 4 role-segmented workspaces:

1. 👑 **Organizers:** Configure multi-round events, define tracks & rubrics, automate GitHub private repository provisioning, trigger bulk email reminders, and analyze event metrics.
2. 🚀 **Students (Hackers):** Form teams, access dedicated workspaces, link GitHub submission repositories, receive live status notifications, and track submission countdown timers.
3. ⚖️ **Judges:** Evaluate team submissions independently against structured rubric criteria, submit locked evaluation matrices, and view real-time leaderboards.
4. 🛡️ **Mentors:** Monitor assigned team progress, schedule advisory sessions, and provide structured feedback.

Additionally, SEAL serves as a **Research-Based Learning (RBL)** data collection engine. It isolates individual judge evaluations per rubric item to generate statistical score matrices for computing **Inter-Rater Reliability** metrics (Krippendorff’s Alpha, Intraclass Correlation Coefficient - ICC) in academic software engineering research.

---

## 📐 System Architecture & Event Lifecycle

The Backend follows a **Modular Monolith Architecture** adhering strictly to **Domain-Driven Layering** (Controller ➔ Service ➔ Core Infrastructure / Prisma ORM ➔ PostgreSQL) and SOLID design principles.

```mermaid
graph TD
    Client[Web & Mobile Clients] -->|REST HTTP Requests| API_Gateway[NestJS Middleware / Guards]
    Client -->|WebSocket WSS| Ws_Gateway[Admin & User Socket.IO Gateway]
    Client -->|SSE Connection| SSE_Stream[Server-Sent Events Controller]

    subgraph "NestJS Application Layer"
        API_Gateway --> Guard[Auth & Roles Guard]
        Guard --> Controller[Domain Controllers]
        Controller --> Service[Domain Services]
        Service --> EventBus[EventEmitter2 Event Bus]
        Service --> Core[Core Infrastructural Modules]
    end

    subgraph "Core Infrastructural Layer"
        Core --> Core_Mail[Mail Module: Nodemailer]
        Core --> Core_Github[Github Module: Octokit API]
        Core --> Core_Storage[Storage Module: AWS S3]
        Core --> Core_Redis[Redis Module: Cache & Locks]
    end

    subgraph "Pure Event-Driven Queue Engine (Redis ZSET)"
        Service -->|1. Schedule / Reschedule Delayed Jobs| Bull_Queue[BullMQ: round-automation Queue]
        Bull_Queue -->|2. Timed Fire via Redis Sorted Set| AutoWorker[Round Queue Processor]
        EventBus --> Bull_Mail[BullMQ: mail-notification Queue]
        Bull_Mail --> MailWorker[Mail Worker Process]
    end

    subgraph "Data Storage Infrastructure"
        Core --> DB[(PostgreSQL Database via Prisma ORM)]
        Core_Redis --> Redis[(Redis Key-Value & ZSET Cache)]
        AutoWorker --> GitHub[GitHub Octokit API]
    end
```

---

## ⚡ Core Technical Features & Engineering Highlights

### 1. Pure Event-Driven Delayed Jobs Architecture (Zero DB Polling)
* **Redis Sorted Set (ZSET) Timers:** Replaces high-overhead database polling (`CronExpression.EVERY_MINUTE`) with pure **BullMQ Delayed Jobs**. Delayed jobs are indexed inside Redis Sorted Sets ordered by exact millisecond execution timestamp (`score = timestamp`), resulting in **0% database query load during countdowns**.
* **Dynamic Job Rescheduling on Deadline Extension:** When an organizer extends a round deadline, existing delayed jobs (`bulk-reminder-15m-round-${id}` and `auto-freeze-round-${id}`) are cleanly removed from Redis and re-indexed with the new delay timestamp.
* **Automated Repository Freezing:** When a delayed job fires, `RoundQueueProcessor` executes repository freezing (`isRepoFrozen: true`) via GitHub Octokit API and emits `round.repos_frozen` event.

### 2. Hybrid Real-Time Architecture (SSE + WebSockets)
* **Server-Sent Events (SSE Engine):** Implements long-lived HTTP streaming via NestJS `@Sse()` endpoints and RxJS `Observable` streams for unidirectional system alerts and heartbeat signals.
* **Socket.IO Real-Time Gateway (`/admin-realtime`):** Manages interactive bidirectional WebSocket connections isolated into channel rooms (`user-${userId}`, `admin-event-${eventId}`, `admin-round-${roundId}`).
* **Wildcard Event Propagation:** Native `@nestjs/event-emitter` configured with `wildcard: true` matches internal domain events (`notification.user.*`, `round.reminder_15m_triggered`) and relays them instantly to WebSocket rooms and SSE streams.

### 3. Multi-Tier Rate Limiting & Cooldown Protection
* **Redis Cooldown Locks:** Enforces a 60-second atomic cooldown lock key (`bulk-remind-cooldown:${roundId}`) using Redis `SET key value EX 60 NX` to prevent concurrent duplicate reminder triggers.
* **Daily Quota Rate Limiting:** Enforces a 24-hour rate-limiting key (`bulk-remind-daily:${roundId}`) capping bulk notifications to a maximum quota (e.g. 5 reminders/day per round).

### 4. Third-Party API Integrations & Presigned S3 Uploads
* **GitHub Octokit API Automation:** Automated private repository creation under organization accounts, team collaborator access assignment, and rate-limited repository freeze/unfreeze operations.
* **AWS S3 Direct Uploads (Presigned URLs):** Generates short-lived (5-minute signed) presigned URLs for client file uploads, eliminating backend bandwidth bottlenecks for heavy project artifacts.

### 5. Standardized Execution Pipeline & Exception Filter
* **Request Lifecycle:** `RequestLoggerMiddleware` ➔ `JwtAuthGuard` / `RolesGuard` ➔ `ValidationPipe` (class-validator) ➔ `Controller` ➔ `AllExceptionsFilter`.
* **Centralized Error Logging:** `AllExceptionsFilter` catches unhandled exceptions, logs full stack traces via Winston Logger with unique request IDs, and returns sanitized JSON error responses to clients.

---

## 🛠️ Technology Stack

| Category | Technology | Usage / Description |
| :--- | :--- | :--- |
| **Framework** | NestJS v10 | Enterprise TypeScript Node.js Framework |
| **Database** | PostgreSQL 16 | Relational Database Engine |
| **ORM** | Prisma ORM 6.x | Type-safe database access & migrations |
| **Queue & Cache** | Redis + BullMQ | Distributed job queues & Redis ZSET delayed timers |
| **Real-time** | Socket.IO + SSE | WebSockets & Server-Sent Events |
| **Storage** | AWS S3 | Direct file uploads via Presigned URLs |
| **Integrations** | Octokit REST/GraphQL | GitHub API organization & repository automation |
| **Logging** | Winston Logger | Structured application logging |

---

## 📂 Repository Directory Structure

```
BE/
├── scripts/                    # E2E test scripts & automation tools
├── src/
│   ├── common/                 # Cross-cutting concerns & shared abstractions
│   │   ├── decorators/         # Custom decorators (@AuthUser, @Roles)
│   │   ├── filters/            # Global exception filters (all-exceptions.filter.ts)
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/       # Response transformation interceptors
│   │   ├── middleware/         # Request logging & context propagation
│   │   └── pipes/              # Custom validation pipes
│   ├── config/                 # Typed environment configurations (app, db, redis)
│   ├── core/                   # Core Infrastructural Modules
│   │   ├── github/             # Octokit API client & repository automation
│   │   ├── health/             # System healthcheck endpoints
│   │   ├── mail/               # Nodemailer SMTP mailer & HTML templates
│   │   ├── redis/              # Redis client & cache provider
│   │   └── storage/            # AWS S3 Presigned URL generator
│   ├── database/               # Prisma service & database seeders
│   ├── logger/                 # Winston logger configuration
│   ├── modules/                # Domain-Driven Feature Modules
│   │   ├── analytics/          # Event performance & scoring statistics
│   │   ├── auth/               # Passport OAuth (Google/GitHub) & JWT strategy
│   │   ├── event/              # Event lifecycle, tracks, rounds, gateways
│   │   ├── feedback/           # Mentor/Judge team feedback
│   │   ├── judge/              # Rubric evaluation & score submission
│   │   ├── mentor/             # Mentor session scheduling & assignments
│   │   ├── notification/       # Notification delivery & WebSocket gateway
│   │   ├── organizer/          # Organizer admin controls
│   │   ├── registration/       # Student event registration
│   │   ├── round/              # Round queues & BullMQ automation processors
│   │   ├── student/            # Student workspace & submission tracking
│   │   ├── submission/         # Team submissions & bulk reminder services
│   │   ├── team/               # Team formation & collaborator invitations
│   │   ├── track/              # Competition tracks
│   │   └── user/               # User profile management
│   ├── app.module.ts           # Core root application module
│   ├── bootstrap.ts            # Application bootstrap & Swagger docs
│   └── main.ts                 # Main execution entrypoint
├── prisma/                     # Database schema definitions & migrations
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Installation

### Prerequisites
* Node.js v18+ or v20+
* PostgreSQL v16+
* Redis v7+

### 1. Environment Setup
Create a `.env` file in the root directory:
```env
APP_PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/seal_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3001
JWT_SECRET=your_jwt_super_secret_key
```

### 2. Install Dependencies & Migrate Database
```bash
# Install dependencies
npm install

# Generate Prisma Type-safe Client
npx prisma generate

# Run Database Migrations
npx prisma migrate dev
```

### 3. Run Development Server
```bash
npm run start:dev
```

* **API Base Endpoint:** `http://localhost:3000/api`
* **Swagger API Documentation:** `http://localhost:3000/api/docs`

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
