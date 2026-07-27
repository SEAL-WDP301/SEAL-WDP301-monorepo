# Organizer Dashboard API

All endpoints require a Bearer access token with the `organizer` role. Event
scope is resolved from the authenticated user; clients must never send an
`organizerId`.

## Current schema assumptions

- An organizer can access an event when `events.created_by` equals the JWT user
  id. The current schema has no event assignment table.
- An approved participant is a registered user with an accepted membership in
  an approved team for the event.
- Registration status is derived from team status because
  `student_registrations` has no status column.
- Event and round date fields are used as deadlines because there is no
  schedule table.
- Event capacity is derived from `Track.maxTeams * Track.maxMembersPerTeam`.

## Shared query

```http
?from=2026-07-01T00:00:00.000Z
&to=2026-07-31T23:59:59.999Z
&eventId=33
&season=Spring
&year=2026
&groupBy=day
```

The maximum custom date range is 366 days. Times are stored and returned in
UTC; clients may render them in `Asia/Ho_Chi_Minh`.

## Endpoints

### Filter options

```http
GET /api/organizer/dashboard/filter-options
```

```json
{
  "events": [
    {
      "id": 33,
      "name": "SEAL Spring 2026",
      "season": "Spring",
      "year": 2026,
      "status": "ongoing"
    }
  ],
  "seasons": ["Spring"],
  "years": [2026]
}
```

### Overview

```http
GET /api/organizer/dashboard/overview?year=2026
```

Returns `totalEvents`, `activeEvents`, `totalRegistrations`,
`totalParticipants`, and `totalSubmissions`. Comparison
metrics contain `previousValue`, `changePercentage`, and `changeDirection`.

### Events by month

```http
GET /api/organizer/dashboard/events-by-month?year=2026
```

Returns all 12 months with `created`, `starting`, and `completed` counts.

### Event status

```http
GET /api/organizer/dashboard/event-status?season=Spring&year=2026
```

Returns all dashboard categories, including categories whose count is zero:
`DRAFT`, `REGISTRATION_OPEN`, `UPCOMING`, `ONGOING`, `COMPLETED`, and
`CANCELLED`.

### Registration trend

```http
GET /api/organizer/dashboard/registration-trend?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&groupBy=day
```

```json
{
  "groupBy": "day",
  "data": [
    {
      "period": "2026-07-01",
      "registrations": 12,
      "approvedParticipants": 8
    }
  ]
}
```

Because the current registration model has no `approvedAt`, approved
participants are grouped by registration creation time.

### Participation conversion

```http
GET /api/organizer/dashboard/participation-conversion?eventId=33
```

Returns separate `registrationFunnel` and `submissionFunnel` arrays plus
`largestDrop`. User and team units are never mixed in one funnel.

### Participants by event

```http
GET /api/organizer/dashboard/participants-by-event?season=Spring&year=2026&limit=5
```

Each row contains registrations, unique approved participants, approved team
count, unique submitted team count, derived capacity, and capacity rate.

### Submissions

```http
GET /api/organizer/dashboard/submissions?eventId=33&groupBy=day
```

Returns:

- `summary`: submitted teams, eligible teams, rates, and last-24-hour count.
- `submissionStatus`: current Prisma submission states.
- `timingStatus`: `ON_TIME` or `LATE`.
- `evaluationStatus`: derived from the presence of score records.
- `activity`: submission and unique-team counts by period.

### Upcoming deadlines

```http
GET /api/organizer/dashboard/upcoming-deadlines?eventId=33&withinDays=30&limit=6
```

Returns event registration/start/end dates and round submission deadlines.
`remainingSeconds` and `UPCOMING`, `URGENT`, or `OVERDUE` status are calculated
at request time.

### Recent registrations

```http
GET /api/organizer/dashboard/recent-registrations?eventId=33&limit=5
```

Returns the latest student registrations with a minimal student profile,
derived registration status, and derived team status.

### Send reminder

```http
POST /api/organizer/notifications/reminders
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "eventId": 33,
  "roundId": 2,
  "audience": "TEAMS_NOT_SUBMITTED",
  "channels": ["IN_APP", "EMAIL"],
  "subject": "Submission deadline is approaching",
  "message": "Please submit your project before the deadline."
}
```

Supported audiences:

- `TEAMS_NOT_SUBMITTED`
- `REGISTERED_PARTICIPANTS`
- `APPROVED_PARTICIPANTS`
- `TEAM_LEADERS`
- `JUDGES`

The backend derives and deduplicates recipients. Accounts with `isActive=false`
are excluded. Identical event/title reminders are rate-limited for five
minutes.

```json
{
  "notificationId": 105,
  "recipientCount": 28,
  "channels": ["IN_APP", "EMAIL"],
  "status": "QUEUED"
}
```

`scheduleId` is rejected with `SCHEDULE_NOT_FOUND` until a schedule entity is
introduced into the Prisma schema.

## Dashboard demo data

After configuring `DATABASE_URL` and applying migrations, populate all
dashboard charts and tables with deterministic demo data:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run seed:dashboard
```

Demo organizer credentials:

```text
Email: organizer.dashboard@seal.local
Password: 12345678
```

The seed creates six events across different seasons, years, months, and
statuses, plus students, registrations, approved and pending teams, rounds,
on-time and late submissions, scores, judge assignments, activity events, and
deadline reminder notifications. Re-running the command only replaces events
whose names begin with `Dashboard Demo`; it does not delete unrelated data.
