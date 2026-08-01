# Event Prize Amount Flow

## Goal
Extend the existing `EventPrize` flow with `amount`, `placement`, and `currency`, while preserving current prize data and supporting totals plus first/second/third validation.

## Tasks
- [x] Inspect current prize rows and map existing primary prizes to placements and amounts.
- [x] Add the three Prisma fields and a safe PostgreSQL migration with data backfill.
- [x] Update BE DTOs, create/update persistence, total calculation, and authoritative prize validation.
- [x] Add BE tests for valid ordering, duplicate placements, invalid ordering, and total prize pool.
- [x] Update FE API types, create/edit form inputs, client validation, and formatted total.
- [x] Update event-facing prize displays to use structured values and placements.
- [x] Apply the migration to the configured database and verify stored rows.
- [x] Run Prisma validation/generation, BE tests/build, and FE tests/typecheck/build.

## Done When
- [x] Existing and newly created prizes persist all three fields in `event_prizes`.
- [x] BE rejects duplicate placements and non-descending first/second/third amounts.
- [x] FE shows field-level validation and a calculated total before submit.
- [x] Public and organizer event APIs expose structured prize data and `prizePoolTotals`.

## Notes
- No new table is introduced.
- `description` remains free text for trophies, certificates, or other non-cash rewards.
- The total is `sum(amount * quantity)`.
