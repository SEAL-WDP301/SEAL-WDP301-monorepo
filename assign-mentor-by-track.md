# Assign mentor by track

## Goal

Show all eligible teams by default and let organizers optionally filter the same list by track before assigning a mentor.

## Tasks

- [x] Keep the team list as the primary control and load all eligible teams when the modal opens.
- [x] Add a compact track dropdown with an All Tracks option.
- [x] Refetch eligible teams and clear selections when the track filter changes.
- [x] Verify type checking, tests, build, and focused accessibility audit.

## Done When

- [x] The default view displays every eligible team in the round.
- [x] Selecting a track triggers a request with `trackId`, `roundId`, `status`, and `hasMentor` filters.
- [x] Select All only selects teams in the currently displayed API result.
