# 🛡️ SEAL – Software Engineering & AI-Driven Hackathon Management Platform

[![CI/CD Pipeline](https://github.com/SEAL-WDP301/SEAL-WDP301-monorepo/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/SEAL-WDP301/SEAL-WDP301-monorepo/actions)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-K3s-326CE5?logo=kubernetes&logoColor=white)](https://k3s.io/)
[![GitOps](https://img.shields.io/badge/GitOps-Argo_CD-EF7B4D?logo=argo&logoColor=white)](https://argoproj.github.io/cd/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS_v10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_v16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis_v7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**SEAL** is an enterprise-grade, cloud-native **Monorepo Platform** engineered to automate, manage, and scale software engineering hackathons and academic competitions. Built on a modern Cloud-Native and GitOps foundation, SEAL eliminates manual event administration by providing automated GitHub organization repository management, real-time multi-pod WebSocket synchronization, pure event-driven delayed scheduling, multi-judge rubric scoring with Inter-Rater Reliability telemetry, and automated Horizontal Pod Auto-scaling (HPA).

---

## 📐 System Architecture & Infrastructure Topology

The platform operates on a production **Kubernetes (K3s)** cluster provisioned via **Terraform** and configured via **Ansible** on cloud infrastructure. Continuous Delivery is driven by an in-cluster **Argo CD Operator (GitOps)** reconciled directly against declarative Kubernetes manifests maintained in this repository.

![System Architecture Diagram](./architecture-system.png)

### Core Architectural Layers

1. **Edge Router & Ingress Layer (Traefik Ingress + Let's Encrypt TLS)**
   - **Traefik Ingress Controller**: Serves as the high-performance reverse proxy and SSL termination point for `sealhackathon.site`.
   - **Automated SSL/TLS**: Managed via `cert-manager` integrated with Let's Encrypt HTTP-01 ACME challenges.
   - **Path-Based Routing**: `/` routes to the Next.js Frontend service, while `/api/*` and `/socket.io/*` route to the NestJS Backend service.

2. **Kubernetes Runtime Environment (Namespace: `hackathon`)**
   - **Backend Engine (`Deployment/backend`)**: Scaled NestJS API instances configured with liveness/readiness health probes (`/api/health`), resource limits (`cpu: 500m`, `memory: 512Mi`), and Horizontal Pod Autoscaler (HPA).
   - **Frontend Client (`Deployment/frontend`)**: Standalone Next.js 16 App Router instances with auto-scaling (`minReplicas: 2`, `maxReplicas: 4`).
   - **Redis Datastore (`StatefulSet/redis`)**: High-throughput in-memory datastore backed by a Persistent Volume Claim (`redis-data`) for state caching, distributed locks, BullMQ queues, and Socket.IO Pub/Sub broadcasting.

3. **GitOps Engine & Sealed Secret Security (`Argo CD` & `SealedSecrets`)**
   - **Bitnami SealedSecrets**: Asymmetrically encrypts sensitive credentials (`app-secret.yaml` ➔ `app-sealed-secret.yaml`) using a cluster-specific RSA Public Key. Encrypted files can be safely committed to Git. The in-cluster `sealed-secrets-controller` automatically decrypts and reconciles them into native Kubernetes `Secret` objects upon deployment.
   - **Argo CD Operator**: Continuously monitors the `k8s/base` directory on the `production` branch. Enforces `Auto-Sync`, `Self-Healing`, and automated pruning of drift resources for zero-downtime rolling updates.

---

## ⚡ Core Engineering Problems Solved

### 1. Multi-Pod Real-Time State Synchronization (`RedisIoAdapter`)
- **The Challenge**: When the Backend is scaled to multiple Kubernetes pods (`replicas: 2+`), users connected via WebSockets to different pods cannot receive broadcast events emitted by another pod.
- **The Solution**: Implemented a custom `RedisIoAdapter` extending `@nestjs/platform-socket.io` backed by `@socket.io/redis-adapter` over Redis Pub/Sub channels. When any backend pod emits an event, it is published to Redis and instantly relayed across all active pod replicas, enabling seamless cross-pod real-time communication without sticky sessions.

### 2. Pure Event-Driven Delayed Scheduling (Zero Database Polling)
- **The Challenge**: Traditional cron jobs polling PostgreSQL databases for round deadlines or email reminders create high query overhead, CPU spikes, and lock contention.
- **The Solution**: Built an event-driven delayed scheduling engine using **BullMQ** and **Redis Sorted Sets (ZSET)**. Round auto-freeze and reminder jobs are indexed by exact millisecond execution timestamps (`score = timestamp`). When round deadlines are extended, existing jobs are dynamically removed and re-scheduled in Redis with zero database query overhead.

### 3. Concurrency Protection & Race Condition Elimination (BullMQ FIFO Queue & Pessimistic Locks)
- **The Challenge**: During peak registration (e.g. final team slot before deadline), concurrent requests across multiple pods can lead to overbooking beyond `maxTeams`.
- **The Solution**: Built a multi-layered defense strategy:
  - **Pessimistic Locking (`SELECT ... FOR UPDATE`)**: Locks event rows within database transactions during team creation.
  - **BullMQ FIFO Queue (`concurrency: 1`)**: High-traffic registrations are queued in Redis and processed sequentially, smoothing traffic spikes and completely preventing race conditions.

### 4. Dynamic Auto-Scaling (Horizontal Pod Autoscaler - HPA)
- **The Challenge**: Hackathon traffic spikes unpredictably during project submission and live judging windows, while remaining low during development phases.
- **The Solution**: Configured Kubernetes HPA metrics monitoring CPU (75%) and Memory (80%) thresholds with stabilization windows (`stabilizationWindowSeconds: 300`) to dynamically scale pods from 2 up to 4 replicas smoothly without pod flapping.

---

## 🛠️ Complete Technology Stack

| Layer | Technology | Version | Rationale & Function |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS / Node.js | v10.4 / Node 22 | Enterprise Modular Monolith framework with strict TypeScript typing, dependency injection, and clean architecture. |
| **Frontend Framework** | Next.js & React | v16.2 / React 18.3 | Feature-driven App Router architecture with Server Components, Client Workspaces, and Edge RBAC middleware. |
| **Database & ORM** | PostgreSQL & Prisma ORM | Postgres 16 / Prisma 6.19 | ACID-compliant relational storage with type-safe migrations and automated schema client generation. |
| **Caching & Messaging**| Redis & BullMQ | Redis 7 / BullMQ 5.81 | In-memory key-value caching, distributed locking, FIFO delayed job queues, and WebSocket Pub/Sub broadcasting. |
| **Real-Time Layer** | Socket.IO & RxJS SSE | Socket.IO 4.8 / SSE | Bidirectional WebSockets for interactive collaboration; HTTP Server-Sent Events (SSE) for system alerts. |
| **Styling & State** | Tailwind CSS & TanStack Query | Tailwind v4 / Query v5 | Utility-first CSS engine with dark-mode glassmorphism tokens; server-state caching and in-memory optimistic updates. |
| **Cluster & Container**| K3s & Docker | K3s v1.28+ / Multi-Stage | CNCF-certified lightweight Kubernetes engine; optimized multi-stage container builds. |
| **GitOps & Secrets** | Argo CD & SealedSecrets | Argo CD v2.10+ / Bitnami | Declarative GitOps deployment controller and asymmetric RSA secret encryption for public Git repos. |
| **Infrastructure as Code**| Terraform & Ansible | Terraform 1.7 / Ansible 2.15 | Automated cloud droplet provisioning and idempotent Kubernetes cluster configuration. |

---

## 🔄 CI/CD & GitOps Execution Workflow

The deployment workflow leverages **GitHub Actions** and **Argo CD** with a strict dual-stage pipeline (Quality Gate on PRs + Automated Deployment on Merge):

```mermaid
flowchart TD
    subgraph "1. Pull Request Stage (Quality Gate)"
        PR[Developer opens PR to production] --> PR_Check[GitHub Actions: PR Workflow]
        PR_Check --> JobBE[Job test-backend: npx tsc --noEmit + Jest Tests]
        PR_Check --> JobFE[Job test-frontend: npx tsc --noEmit + Vitest Tests]
        JobBE & JobFE -->|All Pass (<45s)| MergeReady[PR Mergeable / Quality Gate Passed]
        JobBE & JobFE -->|Any Error| BlockMerge[❌ PR Blocked: Must Fix Syntax / Tests]
    end

    subgraph "2. Push / Merge Stage (Docker Build & GHCR)"
        MergeReady -->|Merge to production| PushEvent[Push Event on branch production]
        PushEvent --> ReCheck[Parallel Quality Gate Verification]
        ReCheck --> BuildBE[Build & Push Backend Docker Image: ghcr.io/seal-wdp301/be:SHA]
        ReCheck --> BuildFE[Build & Push Frontend Docker Image: ghcr.io/seal-wdp301/fe:SHA]
    end

    subgraph "3. GitOps Mutation & Cluster Rollout"
        BuildBE & BuildFE --> Mutate[Update Image Tags in k8s/base/deployment.yaml]
        Mutate --> CommitGit[Git Commit & Push with message '[skip ci]']
        CommitGit --> ArgoSync[Argo CD Operator: Detects Git Manifest Changes]
        ArgoSync --> K8sRollout[K3s Cluster: Zero-Downtime Rolling Update & HPA Management]
    end
```
<<<<<<< HEAD
[ Developer Push / PR ]
         │
         ├──► Branch: 'dev' ─────────► [ Parallel Quality Gate ]
         ├──► PR Branch: 'production'─>├── BE: npx tsc --noEmit + npm run test
         │                             └── FE: npx tsc --noEmit + npm run test
         │                             └── ❌ Fail: Block Merge | ✅ Pass: Complete (<40s)
         │
         └──► Branch: 'production' ──► [ Parallel Quality Gate ]
                                       │   └── (Must Pass 100%)
                                       ▼
                                [ Build & Push Docker Images ] ──► GitHub Container Registry (GHCR)
                                       │
                                       ▼
                                [ Update K8s Manifest Image Tags ]
                                       │   └── Commit & Push to Git [skip ci]
                                       ▼
                                [ Argo CD GitOps Operator ]
                                       │   └── Reconcile Manifests (Auto-Sync & Self-Healing)
                                       ▼
                                [ K3s Kubernetes Cluster ] ──► Zero-Downtime Rolling Update Rollout

---

## 📂 Repository Structure
=======

### Pipeline Stage Details:

1. **Pull Request Quality Gate (PRs targeting `production`)**:
   - Executes parallel `test-backend` (Node 22, `npx prisma generate`, `npx tsc --noEmit`, Jest Unit Tests) and `test-frontend` (Node 22, `npx tsc --noEmit`, Vitest Unit Tests).
   - Fast-fails in ~35-45 seconds without incurring Docker container build overhead, ensuring broken code is never merged into production.

2. **Push / Merge Build Stage**:
   - Re-verifies quality gates ➔ Builds optimized multi-stage Docker images using GitHub Actions cache (`type=gha,mode=max`).
   - Pushes dual tagged images (`:latest` and `:${{ github.sha }}`) to **GitHub Container Registry (GHCR)**.

3. **GitOps Manifest Update & Argo CD Reconciliation**:
   - Automatically mutates deployment image tags in `k8s/base/backend/deployment.yaml` and `k8s/base/frontend/deployment.yaml`.
   - Pushes manifest updates back to the repository using `[skip ci]` to prevent recursive workflow triggers.
   - **Argo CD** detects the updated manifest within seconds, synchronizes the cluster state, and performs a zero-downtime rolling update.

---

## 📂 Monorepo Directory Structure
>>>>>>> 9a17b84 (docs: comprehensive update to root, BE, and FE READMEs highlighting DevOps, architecture, and features)

```
SEAL-WDP301-monorepo/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # Dual-stage GitHub Actions CI/CD Pipeline
├── BE/                        # NestJS Backend API Engine (Prisma, Redis, BullMQ, Socket.IO)
│   ├── src/                   # Modular Monolith domain modules & core infrastructure
│   ├── prisma/                # Prisma schema & relational migrations
│   └── Dockerfile             # Multi-stage production container build
├── FE/                        # Next.js 16 App Router Client (Tailwind v4, React Query)
│   ├── app/                   # Role-based App Router workspaces (/organizer, /student, /judge, /mentor)
│   ├── components/            # Design system, providers, and shared UI components
│   └── Dockerfile             # Multi-stage standalone production container build
├── infrastructure/            # Infrastructure-as-Code
│   ├── ansible/               # Ansible playbooks for K3s, Argo CD, and SealedSecrets setup
│   └── terraform/             # Terraform configurations for cloud compute and DNS
├── k8s/                       # Declarative Kubernetes Manifests (GitOps root)
│   ├── base/                  # Base K8s manifests (Backend, Frontend, Redis, Ingress, HPA)
│   │   ├── backend/           # Deployment, Service, and HPA manifests for Backend
│   │   ├── frontend/          # Deployment, Service, and HPA manifests for Frontend
│   │   ├── redis/             # StatefulSet, Service, and PVC manifests for Redis
│   │   ├── secrets/           # SealedSecret encrypted credential manifests
│   │   └── kustomization.yaml # Kustomize configuration managed by Argo CD
│   └── argocd/                # Argo CD Application manifest (hackathon-platform)
└── README.md                  # Master Monorepo Documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v22.x LTS
- **Docker & Docker Compose**
- **PostgreSQL 16** & **Redis 7**

### 1. Local Monorepo Setup

```bash
# Clone the repository
git clone https://github.com/SEAL-WDP301/SEAL-WDP301-monorepo.git
cd SEAL-WDP301-monorepo

# Start local infrastructure dependencies (Postgres & Redis)
docker-compose up -d

# Setup & start Backend
cd BE
npm install
npx prisma migrate dev
npm run start:dev

# Setup & start Frontend (in a separate terminal)
cd ../FE
npm install
npm run dev
```

### 2. Running Automated Tests

```bash
# Run Backend Jest Unit Tests
cd BE
npm run test

# Run Frontend Vitest Component Tests
cd ../FE
npm run test
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
