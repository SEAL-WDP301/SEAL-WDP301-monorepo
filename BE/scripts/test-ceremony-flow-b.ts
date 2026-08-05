/**
 * Flow B ceremony integration smoke test (Prisma + services, no HTTP).
 * Run: node -r ts-node/register -r tsconfig-paths/register scripts/test-ceremony-flow-b.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient, RoundStatus, TeamStatus } from "@prisma/client";
import { ProblemPoolService } from "../src/modules/event/services/problem-pool.service";
import { TrackAssignmentService } from "../src/modules/event/services/track-assignment.service";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const poolService = new ProblemPoolService(prisma as never);
const trackService = new TrackAssignmentService(prisma as never);

const log = (...a: unknown[]) => console.log("[ceremony-test]", ...a);
const ok = (msg: string) => log("✓", msg);
const warn = (msg: string) => log("⚠", msg);
const fail = (msg: string): never => {
  console.error("[ceremony-test] ✗ FAIL:", msg);
  process.exit(1);
};

const DUMMY_PDF =
  "https://hackathon-submissions.sgp1.digitaloceanspaces.com/general/e2e-demo-problem.pdf";

async function auditExistingFlowBEvents() {
  log("\n=== Audit existing Flow B events ===");
  const events = await prisma.event.findMany({
    where: { deferredTrackAssignment: true },
    select: {
      id: true,
      name: true,
      maxTeams: true,
      status: true,
      tracks: { select: { id: true, name: true } },
      rounds: {
        select: {
          id: true,
          name: true,
          status: true,
          isTrackSpecific: true,
          trackProblems: {
            select: { trackId: true, problemFileUrl: true, track: { select: { name: true } } },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      problemPoolItems: {
        select: { id: true, label: true, assignedRoundId: true },
      },
      _count: { select: { teams: true } },
    },
    orderBy: { id: "desc" },
    take: 5,
  });

  if (!events.length) {
    warn("No Flow B events in DB");
    return;
  }

  for (const e of events) {
    const unassignedPool = e.problemPoolItems.filter((p) => p.assignedRoundId == null).length;
    const teamsNoTrack = await prisma.team.count({
      where: { eventId: e.id, status: TeamStatus.approved, trackId: null },
    });
    log(`\nEvent #${e.id} "${e.name}" (${e.status})`);
    log(`  tracks catalog: ${e.tracks.length} | maxTeams: ${e.maxTeams ?? "—"}`);
    log(`  pool: ${e.problemPoolItems.length} total, ${unassignedPool} unassigned`);
    log(`  approved teams without track: ${teamsNoTrack}`);
    for (const r of e.rounds) {
      const tp = r.trackProblems.length;
      const withProblem = r.trackProblems.filter((x) => x.problemFileUrl?.trim()).length;
      log(
        `  round "${r.name}" [${r.status}] tracks=${tp} problems=${withProblem}/${tp} trackSpecific=${r.isTrackSpecific}`,
      );
    }
  }
}

async function runSyntheticCeremony() {
  log("\n=== Synthetic Flow B ceremony ===");
  const tag = `ceremony-test-${Date.now()}`;

  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    select: { id: true },
  });
  if (!admin) fail("No admin user in DB");

  const event = await prisma.event.create({
    data: {
      name: `E2E Ceremony ${tag}`,
      season: "Summer",
      year: 2026,
      status: "draft",
      deferredTrackAssignment: true,
      maxTeams: 12,
      createdById: admin.id,
    },
  });

  const tracks = await Promise.all(
    ["Bảng Alpha", "Bảng Beta", "Bảng Gamma"].map((name) =>
      prisma.track.create({ data: { eventId: event.id, name } }),
    ),
  );

  const round = await prisma.round.create({
    data: {
      eventId: event.id,
      roundNumber: 1,
      name: "Round 1 Ceremony",
      submissionType: "file",
      submissionDeadline: new Date(Date.now() + 7 * 864e5),
      maxFileSizeMb: 50,
      status: RoundStatus.not_started,
      isTrackSpecific: true,
    },
  });

  for (const t of tracks) {
    await prisma.roundTrackProblem.create({
      data: { roundId: round.id, trackId: t.id, problemFileUrl: null },
    });
  }

  for (let i = 0; i < 3; i++) {
    await poolService.addPoolItem(event.id, {
      label: `Đề ${i + 1} ${tag}`,
      problemFileUrl: DUMMY_PDF,
    });
  }

  const teams = await Promise.all(
    Array.from({ length: 9 }, (_, i) =>
      prisma.team.create({
        data: {
          eventId: event.id,
          name: `Team-${i + 1}-${tag}`,
          status: TeamStatus.approved,
          trackId: null,
          leaderId: admin.id,
        },
      }),
    ),
  );
  ok(`Created event #${event.id}, ${tracks.length} tracks, ${teams.length} teams, 3 pool items`);

  // Phase 1 — problem lottery
  const phase1 = await poolService.lotteryAssignProblemsToRound(event.id, round.id);
  if (phase1.assignments.length !== 3) {
    fail(`Phase 1 expected 3 assignments, got ${phase1.assignments.length}`);
  }
  const rtpAfterP1 = await prisma.roundTrackProblem.findMany({ where: { roundId: round.id } });
  if (rtpAfterP1.some((r) => !r.problemFileUrl?.trim())) {
    fail("Phase 1: some tracks still missing problemFileUrl");
  }
  ok(`Phase 1: ${phase1.assignments.map((a) => `${a.label}→${a.trackName}`).join(", ")}`);

  // Phase 2 — team lottery (round-scoped)
  const phase2 = await trackService.assignDeferredTracks(event.id, { roundId: round.id });
  if (phase2.assignedCount !== 9) {
    fail(`Phase 2 expected 9 assigned, got ${phase2.assignedCount}`);
  }
  const perTrack = phase2.trackCounts.map((c) => c.teamCount);
  if (!perTrack.every((c) => c === 3)) {
    fail(`Phase 2 uneven split: ${JSON.stringify(phase2.trackCounts)}`);
  }
  ok(`Phase 2: 9 teams → 3 per track`);

  // Re-run Phase 2 should skip (sticky)
  const phase2again = await trackService.assignDeferredTracks(event.id, { roundId: round.id });
  if (phase2again.assignedCount !== 0 || phase2again.skippedAlreadyAssigned !== 9) {
    fail("Phase 2 re-run should no-op with 9 skipped");
  }
  ok("Phase 2 re-run: sticky assignment (0 new, 9 skipped)");

  // Open round fallback: no pending teams
  const phase2open = await trackService.assignDeferredTracks(event.id, { roundId: round.id });
  if (phase2open.assignedCount !== 0) {
    fail("Open-round fallback should not reassign");
  }
  ok("Open-round fallback: no reassignment");

  // Cleanup
  await prisma.eventProblemPoolItem.deleteMany({ where: { eventId: event.id } });
  await prisma.roundTrackProblem.deleteMany({ where: { roundId: round.id } });
  await prisma.team.deleteMany({ where: { eventId: event.id } });
  await prisma.round.deleteMany({ where: { eventId: event.id } });
  await prisma.track.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });
  ok(`Cleaned up synthetic event #${event.id}`);
}

async function main() {
  try {
    await auditExistingFlowBEvents();
    await runSyntheticCeremony();
    log("\n=== ALL CEREMONY CHECKS PASSED ===\n");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
