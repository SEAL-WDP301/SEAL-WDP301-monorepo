/**
 * One-time backfill for the "track scoped per round" change.
 *
 * Before this change, every track-specific round implicitly required a
 * problem file for EVERY track in the event (see assertRoundProblemsReady).
 * Going forward, for DEFERRED events (Flow B — "Use tracks for this event"
 * unticked), a track only counts for a round if it has an explicit
 * RoundTrackProblem row (added via "Add Track" / "Add existing track" inside
 * that round) — each round can define its own subset of tracks/đề. To avoid
 * silently loosening requirements for deferred rounds that were already
 * configured under the old implicit behavior, this script creates the
 * missing RoundTrackProblem rows (with problemFileUrl: null) for every
 * existing track-specific round belonging to a deferred event.
 *
 * Regular (Flow A, non-deferred) rounds are left untouched — Track is the
 * parent spanning every round there, so they always require every event
 * track by design (see assertRoundProblemsReady), independent of any
 * per-round scoping.
 *
 * Safe to re-run: only creates rows that don't already exist (skipDuplicates).
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/backfill-round-track-scope.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rounds = await prisma.round.findMany({
    where: {
      isTrackSpecific: true,
      event: { deferredTrackAssignment: true },
    },
    select: {
      id: true,
      name: true,
      eventId: true,
      event: {
        select: {
          id: true,
          name: true,
          tracks: { select: { id: true, name: true } },
        },
      },
      trackProblems: { select: { trackId: true } },
    },
  });

  console.log(`Found ${rounds.length} track-specific round(s) to check.`);

  let totalCreated = 0;

  for (const round of rounds) {
    const existingTrackIds = new Set(round.trackProblems.map((p) => p.trackId));
    const missingTracks = round.event.tracks.filter(
      (t) => !existingTrackIds.has(t.id),
    );

    if (!missingTracks.length) continue;

    const result = await prisma.roundTrackProblem.createMany({
      data: missingTracks.map((t) => ({
        roundId: round.id,
        trackId: t.id,
        problemFileUrl: null,
      })),
      skipDuplicates: true,
    });

    totalCreated += result.count;
    console.log(
      `Event "${round.event.name}" (#${round.eventId}) — Round "${round.name}" (#${round.id}): scoped ${result.count} track(s): ${missingTracks
        .map((t) => t.name)
        .join(", ")}`,
    );
  }

  console.log(`Done. Created ${totalCreated} RoundTrackProblem row(s) total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
