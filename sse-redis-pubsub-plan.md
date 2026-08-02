# SSE Real-Time Notifications Redis Pub/Sub Upgrade Plan

## Goal
Upgrade the Real-Time Notification SSE Stream (`/notifications/stream`) from Node.js in-memory `EventEmitter2` to **Redis Pub/Sub**. This guarantees that when a notification is created on any Backend Pod in Kubernetes, all connected users receive their real-time notifications instantaneously (< 1ms) regardless of which Backend Pod their SSE connection is attached to.

---

## Technical Stack & Scope
* **Backend:** NestJS, ioredis, Redis Pub/Sub, RxJS `Observable`
* **Scope:** `BE/src/core/redis/redis.service.ts`, `BE/src/modules/notification/services/notification.service.ts`, `BE/src/modules/notification/controllers/notification.controller.ts`

---

## Tasks

### 1. Backend: Redis Service Pub/Sub Helper Methods
- [ ] Add `publish(channel: string, message: string)` method in `RedisService`.
- [ ] Inject duplicate Subscriber Redis client `subClient` for subscribing to channels without blocking standard Redis commands.
- [ ] Add `subscribeChannel(channel: string)` returning an RxJS `Observable<string>` with proper unsubscription cleanup.
- → **Verify:** `publish` & `subscribeChannel` pass unit checks.

### 2. Backend: Notification Service Redis Pub/Sub Integration
- [ ] Update `createNotification` and `createManyNotifications` to `publish` notification payloads to Redis channel `notifications:user:<userId>`.
- [ ] Update `streamNotifications(userId)` in `NotificationService` to subscribe to `notifications:user:<userId>` via Redis Pub/Sub and stream SSE `MessageEvent`.
- [ ] Keep `EventEmitter2` as a local fallback for in-process event listeners.
- → **Verify:** Notifications created on one process are received on another process via Redis Pub/Sub.

### 3. Build & System Verification
- [ ] Run `npm run build` in `BE` and `FE` to ensure zero compilation errors.
- → **Verify:** Both builds complete with 0 errors.

---

## Done When
- [ ] Notification SSE Stream uses Redis Pub/Sub for cross-pod real-time delivery.
- [ ] Disconnecting SSE client unsubscribes from Redis cleanly.
- [ ] `npm run build` passes cleanly in `BE` and `FE`.
