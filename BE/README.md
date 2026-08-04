# 🛡️ SEAL – Hackathon Management Platform (Backend Engine)

[![NestJS](https://img.shields.io/badge/NestJS-v10.4-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-v7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5.81-E10098?logo=bullmq&logoColor=white)](https://bullmq.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-ready, high-concurrency **Backend API Engine** for **SEAL** (Software Engineering & AI-driven Hackathon Management Platform). Built with NestJS, Prisma ORM, Redis, BullMQ, Socket.IO with Redis Pub/Sub Adapter, RxJS SSE Streams, and Winston Logger, this system automates end-to-end hackathon events—from automated GitHub organization repository provisioning and multi-channel notifications to multi-judge rubric scoring and statistical Inter-Rater Reliability telemetry.

---

## 📌 Project Overview & Value Proposition

Organizing software engineering hackathons involves high operational overhead: enforcing strict multi-round submission deadlines, provisioning GitHub team repositories, managing collaborator permissions, routing mentor and judge feedback, and evaluating team projects fairly across structured rubric criteria.

**SEAL Backend** digitizes and automates this entire lifecycle across role-based workspaces:

1. 👑 **Organizers:** Create multi-round events, define competition tracks and rubrics, automate GitHub private organization repository creation, trigger bulk email reminders, and monitor real-time event analytics & SSE streams.
2. 🚀 **Students (Hackers):** Register for events, form teams, link GitHub submission repositories, receive real-time updates, and monitor live round submission countdown timers.
3. ⚖️ **Judges:** Access structured evaluation rubrics, evaluate team submissions independently, submit locked score matrices, and view live leaderboards.
4. 🛡️ **Mentors:** Monitor assigned teams, schedule advisory feedback sessions, and provide real-time guidance.

Additionally, SEAL acts as a **Research-Based Learning (RBL)** data collection engine. It records itemized judge scoring matrices per rubric criterion to compute **Inter-Rater Reliability** statistical metrics (Krippendorff’s Alpha, Intraclass Correlation Coefficient - ICC) for academic software engineering research.

---

## 📐 Project Architecture & Structural Rationale

The Backend engine is designed as a **Modular Monolith Architecture** adhering strictly to **Domain-Driven Layering** (Controller ➔ Service ➔ Core / Prisma ORM ➔ PostgreSQL) and SOLID principles.

```mermaid
graph TD
    Client[Web Clients / Mobile Frontend] -->|REST HTTP API| API_Gateway[NestJS Guards & ValidationPipes]
    Client -->|WebSocket & SSE| Ws_Gateway[Socket.IO & SSE Streams]

    subgraph "NestJS Modular Monolith Layer"
        API_Gateway --> Guard[Auth & Roles Guard: JWT]
        Guard --> Controller[Domain Controllers]
        Controller --> Service[Domain Services]
        Service --> EventBus[EventEmitter2 Internal Bus]
        Service --> Core[Core Infrastructural Modules]
    end

    subgraph "Real-Time & Background Processing Engine"
        Ws_Gateway --> RedisAdapter[RedisIoAdapter: Socket.IO Pub/Sub]
        Service -->|Schedule Delayed Jobs| Bull_Queue[BullMQ: round-automation Queue]
        Bull_Queue -->|Redis ZSET Timed Fire| AutoWorker[Round Queue Processor]
        EventBus --> Bull_Mail[BullMQ: mail-notification Queue]
        Bull_Mail --> MailWorker[Mail Worker Process]
        EventBus --> RedisPubSub[Redis Pub/Sub ➔ SSE Realtime Stream]
    end

    subgraph "Data Storage & Integration Infrastructure"
        Core --> DB[(PostgreSQL 16 via Prisma ORM 6.19)]
        Core --> Redis[(Redis 7: Caching, Locks & Pub/Sub)]
        Core --> S3[AWS S3 Storage via Presigned URLs]
        AutoWorker --> GitHub[GitHub Octokit API]
        RedisAdapter <--> Redis
    end
```

### Architectural Rationale: Modular Monolith

* **Domain Encapsulation & Clean Layering**: Keeps discrete business domains (`auth`, `event`, `team`, `submission`, `judge`, `round`, `rubric`, `github`, `notification`, `analytics`, `chat`, `assistant`) partitioned into clear, decoupled NestJS modules with distinct DTOs, Controllers, Services, and Prisma ORM models.
* **In-Memory Performance & High Efficiency**: Runs inside a single unified Node.js/NestJS process. Services communicate in-memory via NestJS Dependency Injection (DI) with zero network overhead between domain modules, connected to a centralized PostgreSQL database managed by Prisma ORM.
* **Event-Driven Decoupling**: Utilizes NestJS `EventEmitter2` for internal async event publishing (`team.registered`, `submission.created`) and Redis Pub/Sub paired with Server-Sent Events (SSE) for 1-way organizer realtime updates, keeping modules decoupled and performant.

---

## ⚡ Technical Features & Engineering Highlights

### 1. Multi-Pod WebSocket Scaling (`RedisIoAdapter`) & SSE Real-time Streams
- **WebSockets**: Implemented custom `RedisIoAdapter` extending `@nestjs/platform-socket.io` and powered by `@socket.io/redis-adapter` over `ioredis`. Real-time Socket.IO room messages (`user-${userId}`, `admin-event-${eventId}`, `admin-round-${roundId}`) broadcast seamlessly across scaled Kubernetes backend pods (`replicas: 2+`) via Redis Pub/Sub without sticky sessions.
- **Server-Sent Events (SSE)**: Built `@Sse()` streams backed by Redis Pub/Sub channels for 1-way real-time push notifications to Organizers (e.g. instant registration and submission alerts).

### 2. Pure Event-Driven Delayed Jobs (Zero Database Polling)
- **Integration**: Powered by **BullMQ** and **Redis Sorted Sets (ZSET)** (`round-automation` and `mail-notification` queues).
- **Function**: Replaces high-overhead database polling scripts (`@Cron`) with pure delayed jobs indexed by millisecond execution timestamps. When round deadlines are extended, existing delayed jobs (`bulk-reminder-15m-round-${id}` and `auto-freeze-round-${id}`) are cleanly removed from Redis and re-indexed with zero database query load.

### 3. Automated GitHub Organization Repository Provisioning
- **Integration**: Built on `@octokit/rest` API client.
- **Function**: Automates private repository creation under organization accounts, team collaborator access assignment, and automated repository freezing (`isRepoFrozen: true`) upon round deadline completion.

### 4. Direct Cloud Artifact Uploads (AWS S3 Presigned URLs)
- **Integration**: Uses `@aws-sdk/client-s3`.
- **Function**: Generates 5-minute signed Presigned URLs for client file uploads, allowing direct browser-to-S3 binary transfers and eliminating backend server bandwidth bottlenecks.

---

## 🛠️ Complete Technology Stack

| Category | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Framework** | NestJS | v10.4.0 | Enterprise TypeScript Node.js Framework |
| **Database** | PostgreSQL | 16.x | Relational Database Management System |
| **ORM** | Prisma ORM | v6.19.3 | Type-safe database client and migration engine |
| **Queue & Caching** | Redis & BullMQ | Redis 7 / BullMQ 5.81 | Redis caching, distributed locks, BullMQ delayed job queues |
| **Real-Time Adapter** | Socket.IO & RxJS SSE | v4.8.3 | WebSockets with Redis Pub/Sub adapter & NestJS SSE Streams |
| **Email Service** | Nodemailer & NestJS Mailer | v8.0 / v2.3 | HTML email notifications with SMTP integration |
| **GitHub Automation** | Octokit REST API | v22.0.1 | Automated repository creation & organization management |
| **Object Storage** | AWS S3 SDK | v3.1067 | Direct file upload presigned URL generation |
| **Logging** | Winston Logger | v3.17.0 | Structured JSON application logging with log levels |
| **Testing** | Jest | v29.x | Unit and integration test runner (`npm run test`) |

---

## 📂 Backend Directory Structure

```
BE/
├── scripts/                    # Automation scripts & E2E testers
├── src/
│   ├── common/                 # Shared decorators, filters, guards, pipes, interceptors
│   │   ├── constants/          # Application constants
│   │   ├── decorators/         # @CurrentUser, @Roles
│   │   ├── filters/            # AllExceptionsFilter
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/       # TransformInterceptor
│   │   └── pipes/              # ValidationPipe
│   ├── config/                 # Typed environment configuration files
│   ├── core/                   # Infrastructure Core Modules
│   │   ├── github/             # Octokit API client & repository manager
│   │   ├── health/             # Healthcheck endpoints (/api/health)
│   │   ├── mail/               # Nodemailer email dispatching
│   │   ├── redis/              # RedisService & RedisIoAdapter Pub/Sub
│   │   └── storage/            # AWS S3 Presigned URL provider
│   ├── database/               # PrismaService & database seeders
│   ├── logger/                 # Winston logging setup
│   ├── modules/                # Domain Modules (Modular Monolith)
│   │   ├── analytics/          # Scoring analytics & Inter-Rater Reliability telemetry
│   │   ├── assignment/         # Judge & Mentor team assignment logic
│   │   ├── assistant/          # AI assistant role resolver
│   │   ├── auth/               # Auth endpoints, JWT strategy, OAuth & OTP verification
│   │   ├── chat/               # Real-time WebSocket chat gateway
│   │   ├── dev-e2e/            # Development E2E tester endpoints
│   │   ├── event/              # Hackathon event, organizer, judge & SSE controllers
│   │   ├── feedback/           # Mentor/Judge feedback gateway
│   │   ├── github/             # GitHub webhooks & repo management queues
│   │   ├── integration/        # External service integrations
│   │   ├── notification/       # Notification controllers & SSE streams
│   │   ├── round/              # Round automation queues & delayed processors
│   │   ├── rubric/             # Rubric criteria management
│   │   ├── submission/         # Team project submissions & AI automated review
│   │   ├── team/               # Team formation, student status & invitations
│   │   └── user/               # User profiles & management
│   ├── app.module.ts           # Root application module
│   ├── bootstrap.ts            # Application bootstrap & Swagger OpenAPI docs
│   └── main.ts                 # Application entrypoint
├── prisma/                     # Database schema definition & migrations
│   ├── migrations/             # SQL migration files
│   └── schema.prisma           # Primary Prisma data model schema
├── package.json
└── README.md
```

---

## 🚀 Quick Start & Local Execution

### 1. Environment Setup
Create a `.env` file inside the `BE/` directory:
```env
APP_PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/seal_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3001
JWT_SECRET=your_super_secret_jwt_key
```

### 2. Install Dependencies & Generate Prisma Client
```bash
cd BE
npm install
npx prisma generate
npx prisma migrate dev
```

### 3. Run Development Server & Unit Tests
```bash
# Start backend in watch mode
npm run start:dev

# Run all backend unit tests
npm run test
```

* **API Base Endpoint:** `http://localhost:3000/api`
* **Swagger API Documentation:** `http://localhost:3000/api/docs`

---

## 📄 License
This module is licensed under the [MIT License](LICENSE).
