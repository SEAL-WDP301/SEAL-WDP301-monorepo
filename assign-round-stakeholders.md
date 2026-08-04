# Round-scoped stakeholder assignment

## Goal
Keep judge tracks and mentor teams scoped to the current round without changing assignment APIs or schemas.

## Tasks
- [x] Fetch the current round's teams with their track and mentor data. → Verify no event-wide team filtering remains.
- [x] Derive judge tracks from those teams and add an "All tracks" checkbox. → Verify it selects concrete track IDs and handles an empty round.
- [x] Replace the mentor stakeholder dropdown with a searchable radio list. → Verify Judge badges and selected styling.
- [x] Show all approved, unmentored teams in the round with track names and Select All. → Verify bulk assignment payload is unchanged.
- [x] Run frontend lint, type-check, tests, and build. → Verify all commands pass or report pre-existing failures.

## Done When
- [x] Judge and mentor assignment behavior matches the current-round requirements with no backend/schema changes.
