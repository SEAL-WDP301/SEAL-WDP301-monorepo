# 🛡️ SEAL – Hackathon Management Platform (Backend API Engine)

[![NestJS](https://img.shields.io/badge/NestJS-v10.4-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma_ORM-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-v7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v5.81-E10098?logo=bullmq&logoColor=white)](https://bullmq.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Jest](https://img.shields.io/badge/Testing-Jest_Unit_Tests-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The **SEAL Backend Engine** is an enterprise-grade, high-throughput RESTful API and real-time event processing system built with **NestJS**, **Prisma ORM**, **PostgreSQL**, **Redis**, and **BullMQ**. It powers the entire backend lifecycle of software engineering hackathons—from automated GitHub organization repository provisioning and multi-round deadline scheduling to real-time chat, AI scoring assistants, and academic Inter-Rater Reliability (IRR) telemetry.

---

## 📐 Backend Architecture & Design Philosophy

The backend is structured as a **Modular Monolith Architecture** adhering strictly to **Domain-Driven Layering** (Controller ➔ Service ➔ Repository / Prisma ORM ➔ PostgreSQL) and SOLID design principles.

```mermaid
graph TD
    Client[Web & Mobile Clients] -->|REST API Requests| API_Gateway[NestJS Global Guards & ValidationPipes]
    Client -->|WebSocket & SSE Streams| Realtime_Gateway[Socket.IO & SSE Gateway Layer]

    subgraph "NestJS Modular Monolith Core"
        API_Gateway --> Guard[AuthGuard: JWT & RolesGuard]
        Guard --> Controller[Domain Controllers: Auth, Event, Team, Round, Submission, Analytics]
        Controller --> Service[Domain Business Services]
        Service --> EventBus[EventEmitter2 Internal Event Bus]
        Service --> CoreModules[Core Infrastructure Modules]
    end

    subgraph "Real-Time & Queue Processing Subsystem"
        Realtime_Gateway --> RedisAdapter[RedisIoAdapter: Socket.IO Redis Pub/Sub]
        Service -->|Queue Delayed / FIFO Jobs| Bull_Engine[BullMQ: round-automation, team-registration, mail-notification]
        Bull_Engine -->|Redis ZSET Timed Trigger| QueueWorkers[BullMQ Processors & Workers]
        EventBus --> RedisPubSub[Redis Pub/Sub ➔ SSE Event Channels]
    end

    subgraph "Data Storage & External Integrations"
        CoreModules --> DB[(PostgreSQL 16 via Prisma ORM 6.19)]
        CoreModules --> Redis[(Redis 7: Caching, Distributed Locks & State)]
        CoreModules --> S3[AWS S3 / DigitalOcean Spaces via Presigned URLs]
        CoreModules --> AI[AI Engine: Google Gemini 2.5 & OpenAI GPT-4o-mini]
        QueueWorkers --> GitHub[GitHub Octokit REST API]
        RedisAdapter <--> Redis
    end
```

### Architectural Highlights

* **Modular Monolith Paradigm**: Partitions business logic into isolated, domain-specific modules (`auth`, `event`, `team`, `submission`, `round`, `rubric`, `analytics`, `assistant`, `chat`, `notification`). Modules communicate through typed dependency injection with zero inter-service network latency.
* **ACID Relational Integrity**: Uses PostgreSQL with Prisma ORM to guarantee data consistency across complex multi-table transactions (e.g. team member invitations, deadline updates, score evaluations).
* **Decoupled Asynchronous Processing**: Utilizes `EventEmitter2` for in-memory domain events, paired with **BullMQ** for durable background queue processing and **Redis Pub/Sub** for cross-pod real-time broadcasting.

---

## ⚡ Core Technical Features & Engineering Highlights

### 1. Multi-Pod WebSocket Scaling (`RedisIoAdapter`) & SSE Streams
* **Socket.IO Real-Time Sync**: Implemented a custom `RedisIoAdapter` extending `@nestjs/platform-socket.io` and powered by `@socket.io/redis-adapter` over Redis Pub/Sub channels. Enables real-time team chat, inline rubric scoring updates, and feedback broadcasting across multiple Kubernetes backend replicas (`replicas: 2+`) without requiring sticky sessions.
* **Server-Sent Events (SSE)**: Provides high-efficiency, one-way event streaming (`@Sse('stream')`) backed by Redis channels for organizer dashboards, live countdown alerts, and system event notifications.

### 2. Pure Event-Driven Delayed Job Scheduling (Zero DB Polling)
* **The Problem**: Polling relational databases via cron scripts (`@Cron`) to check for expired deadlines causes high CPU usage, lock contention, and query latency.
* **The Solution**: Built an event-driven scheduler using **BullMQ** and **Redis Sorted Sets (ZSET)**. Round auto-freeze and reminder jobs are indexed by millisecond execution timestamps (`score = timestamp`). When organizers extend round deadlines, existing delayed jobs are dynamically removed and re-scheduled in Redis with zero database query overhead.

### 3. Flash-Sale Concurrency Protection (BullMQ FIFO Queue & Pessimistic Locks)
* **The Problem**: During peak registration periods (e.g., the last team slot before deadline), concurrent requests across multiple pods can cause overbooking beyond `maxTeams`.
* **The Solution**: Implemented a two-tier concurrency defense:
  - **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**: Locks the event row during database transactions to enforce strict atomicity.
  - **BullMQ FIFO Queue (`concurrency: 1`)**: High-traffic team registration requests are queued in Redis and processed sequentially, smoothing traffic spikes and eliminating race conditions.

### 4. Automated GitHub Organization Repository Management
* **Integration**: Powered by `@octokit/rest` and BullMQ background workers.
* **Functionality**: Automatically creates private GitHub repositories under the organization account for approved teams, assigns student collaborator permissions, manages webhooks for commit activity tracking, and automatically freezes repository push access (`isRepoFrozen: true`) when the round deadline passes.

### 5. Multi-Judge Rubric Evaluation & Inter-Rater Reliability (IRR) Telemetry
* **Rubric Matrix Scoring**: Supports multi-criteria evaluation rubrics with customizable weights and scoring scales.
* **Academic Research Telemetry**: Serves as a Research-Based Learning (RBL) engine by capturing itemized judge scoring matrices to compute statistical **Inter-Rater Reliability** metrics (Krippendorff’s Alpha, Intraclass Correlation Coefficient - ICC) for evaluating judging consistency.

### 6. AI-Powered Role Assistants (SEAL Assistant, Mentor, Judge AI)
* **Integration**: Integrates **Google Gemini 2.5 Flash** and **OpenAI GPT-4o-mini**.
* **Capabilities**: Provides context-aware role assistance:
  - **Judge AI**: Generates rubric score suggestions based on submission repository code and documentation analysis.
  - **Mentor AI**: Generates constructive feedback drafts for student teams based on project progress.
  - **SEAL Assistant**: Intelligent conversational agent answering participant inquiries on rules, deadlines, and submission requirements.

---

## 🛠️ Complete Backend Technology Stack

| Category | Technology | Version | Purpose & Rationale |
| :--- | :--- | :--- | :--- |
| **Framework** | NestJS | v10.4.0 | Enterprise-grade TypeScript framework with dependency injection and modularity. |
| **Database** | PostgreSQL | 16.x | ACID-compliant relational database for structured domain data. |
| **ORM** | Prisma ORM | v6.19.3 | Type-safe database access, automated schema migrations, and relational modeling. |
| **Caching & Queues** | Redis & BullMQ | Redis 7 / BullMQ 5.81 | In-memory caching, distributed locks, delayed timers, and FIFO registration queues. |
| **Real-Time Engine** | Socket.IO & RxJS SSE | v4.8.3 / RxJS 7.8 | WebSocket rooms with Redis Pub/Sub adapter & Server-Sent Events streams. |
| **GitHub Automation** | Octokit REST API | v22.0.1 | Automated repository provisioning, collaborator management, and webhook handling. |
| **AI Integration** | Google Gen AI & OpenAI | Gemini 2.5 / GPT-4o | Automated rubric scoring suggestions, mentor draft feedback, and role assistant. |
| **Cloud Storage** | AWS S3 SDK | v3.1067 | Direct presigned URL generation for client binary uploads. |
| **Email Service** | Nodemailer & NestJS Mailer | v8.0 / v2.3 | HTML notification templates with SMTP delivery. |
| **Logging** | Winston Logger | v3.17.0 | Structured JSON application logging with log levels. |
| **Unit Testing** | Jest & Supertest | v29.x | Comprehensive unit and integration test suite. |

---

## 📂 Backend Directory Structure

```
BE/
├── prisma/
│   ├── migrations/             # Relational database schema migrations
│   └── schema.prisma           # Central Prisma schema definition
├── src/
│   ├── common/                 # Global decorators, filters, guards, and validation pipes
│   │   ├── decorators/         # @CurrentUser, @Roles
│   │   ├── filters/            # AllExceptionsFilter (Standardized JSON error responses)
│   │   ├── guards/             # JwtAuthGuard, RolesGuard, WsJwtGuard
│   │   └── pipes/              # ValidationPipe (Class-validator DTO transformations)
│   ├── config/                 # Typed environment configurations (database, redis, jwt, ai)
│   ├── core/                   # Core Infrastructure Services
│   │   ├── github/             # Octokit API client & repository manager
│   │   ├── health/             # Healthcheck endpoints (/api/health)
│   │   ├── mail/               # Nodemailer email dispatcher
│   │   ├── redis/              # RedisService & RedisIoAdapter (Pub/Sub)
│   │   └── storage/            # AWS S3 / DigitalOcean Spaces Presigned URL provider
│   ├── database/               # PrismaService and database seeders
│   ├── logger/                 # Winston logging configuration
│   └── modules/                # Domain Business Modules (Modular Monolith)
│       ├── analytics/          # Scoring analytics & Inter-Rater Reliability telemetry
│       ├── assignment/         # Judge & Mentor team assignment services
│       ├── assistant/          # AI assistant role resolver (Gemini / OpenAI)
│       ├── auth/               # JWT authentication, OAuth (Google/GitHub), and OTP verification
│       ├── chat/               # Real-time WebSocket chat gateway with membership security
│       ├── event/              # Event management, tracks, and organizer workflows
│       ├── feedback/           # Mentor/Judge feedback gateway & student review services
│       ├── github/             # GitHub webhooks & asynchronous repo creation queues
│       ├── integration/        # External integrations (Google Calendar OAuth & sync)
│       ├── notification/       # Notification controllers, queues, and SSE stream endpoints
│       ├── round/              # Round lifecycle, auto-freeze timers, and delayed BullMQ queues
│       ├── rubric/             # Evaluation criteria and scoring rubrics
│       ├── submission/         # Team project submissions and AI scoring analysis
│       ├── team/               # Team formation, invitations, and BullMQ FIFO registration queue
│       └── user/               # User profiles and account management
├── test/                       # E2E test suites and fixtures
├── Dockerfile                  # Multi-stage production container build
├── package.json
└── tsconfig.json
```

---

## 🚀 Local Development Setup

### 1. Environment Configuration
Create a `.env` file in the `BE/` directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Database & Redis
DATABASE_URL="postgresql://user:password@localhost:5432/seal_db?sslmode=disable"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=""

# JWT Secrets
JWT_ACCESS_SECRET="super_secret_access_key"
JWT_REFRESH_SECRET="super_secret_refresh_key"
COOKIE_SECRET="super_secret_cookie_key"

# AI Integrations
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# Mail (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 2. Database Migration & Seed
```bash
cd BE

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed initial admin & demo data
npm run seed
```

### 3. Run Development Server
```bash
# Start in watch mode
npm run start:dev

# Start in production mode
npm run start:prod
```

### 4. Run Automated Test Suite
```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run test coverage report
npm run test:cov
```

---

## 📄 License

This backend engine is part of the SEAL Platform, licensed under the [MIT License](LICENSE).
