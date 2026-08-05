/**
 * Full Flow B + scoring integration suite (Prisma + services, no HTTP).
 *
 * Run:
 *   node -r ts-node/register -r tsconfig-paths/register scripts/test-full-flow-b-suite.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import {
  PrismaClient,
  RoundStatus,
  SubmissionStatus,
  TeamStatus,
} from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ProblemPoolService } from "../src/modules/event/services/problem-pool.service";
import { TrackAssignmentService } from "../src/modules/event/services/track-assignment.service";
import { RoundRankingService } from "../src/modules/event/services/round-ranking.service";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const poolService = new ProblemPoolService(prisma as never);
const trackService = new TrackAssignmentService(prisma as never);
const rankingService = new RoundRankingService(
  prisma as never,
  { emit: () => undefined } as unknown as EventEmitter2,
  { syncRepositoriesForRound: async () => undefined } as never,
  { sendRoundResultEmail: async () => undefined } as never,
);

const PDF =
  "https://hackathon-submissions.sgp1.digitaloceanspaces.com/general/e2e-demo-problem.pdf";

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    passed++;
    console.log("OK");
  } catch (e) {
    failed++;
    console.log("FAIL");
    console.error(`    → ${(e as Error).message}`);
  }
}

async function expectThrow(
  fn: () => Promise<unknown>,
  pattern?: RegExp | string,
) {
  try {
    await fn();
    throw new Error("expected throw");
  } catch (e) {
    if ((e as Error).message === "expected throw") throw e;
    if (pattern) {
      const msg = (e as Error).message;
      if (typeof pattern === "string" ? !msg.includes(pattern) : !pattern.test(msg)) {
        throw new Error(`throw message mismatch: ${msg}`);
      }
    }
  }
}

type EventCtx = { eventId: number; roundId: number; trackIds: number[]; adminId: number };

async function createFlowBBase(opts: {
  tag: string;
  trackNames: string[];
  teamCount: number;
  poolCount: number;
  maxTeams?: number;
}): Promise<EventCtx & { teamIds: number[] }> {
  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user");

  const event = await prisma.event.create({
    data: {
      name: `Suite ${opts.tag}`,
      season: "Summer",
      year: 2026,
      status: "active",
      deferredTrackAssignment: true,
      maxTeams: opts.maxTeams ?? 50,
      createdById: admin.id,
    },
  });

  const tracks = await Promise.all(
    opts.trackNames.map((name) =>
      prisma.track.create({ data: { eventId: event.id, name } }),
    ),
  );

  const round = await prisma.round.create({
    data: {
      eventId: event.id,
      roundNumber: 1,
      name: `R1 ${opts.tag}`,
      submissionType: "file",
      status: RoundStatus.not_started,
      isTrackSpecific: true,
      submissionDeadline: new Date(Date.now() + 7 * 864e5),
      maxFileSizeMb: 50,
    },
  });

  for (const t of tracks) {
    await prisma.roundTrackProblem.create({
      data: { roundId: round.id, trackId: t.id, problemFileUrl: null },
    });
  }

  for (let i = 0; i < opts.poolCount; i++) {
    await poolService.addPoolItem(event.id, {
      label: `De ${i + 1} ${opts.tag}`,
      problemFileUrl: PDF,
    });
  }

  const teams = await Promise.all(
    Array.from({ length: opts.teamCount }, (_, i) =>
      prisma.team.create({
        data: {
          eventId: event.id,
          name: `Team-${i + 1}-${opts.tag}`,
          status: TeamStatus.approved,
          trackId: null,
          leaderId: admin.id,
          teamRounds: { create: { roundId: round.id, status: "competing" } },
        },
      }),
    ),
  );

  return {
    eventId: event.id,
    roundId: round.id,
    trackIds: tracks.map((t) => t.id),
    teamIds: teams.map((t) => t.id),
    adminId: admin.id,
  };
}

async function runCeremony(ctx: EventCtx) {
  await poolService.lotteryAssignProblemsToRound(ctx.eventId, ctx.roundId);
  return trackService.assignDeferredTracks(ctx.eventId, { roundId: ctx.roundId });
}

async function cleanupEvent(eventId: number) {
  await prisma.score.deleteMany({ where: { submission: { round: { eventId } } } });
  await prisma.judgeVote.deleteMany({
    where: { submission: { round: { eventId } } },
  });
  await prisma.submission.deleteMany({ where: { round: { eventId } } });
  await prisma.judgeAssignment.deleteMany({ where: { round: { eventId } } });
  await prisma.criterion.deleteMany({ where: { round: { eventId } } });
  await prisma.teamRound.deleteMany({ where: { round: { eventId } } });
  await prisma.team.deleteMany({ where: { eventId } });
  await prisma.eventProblemPoolItem.deleteMany({ where: { eventId } });
  await prisma.roundTrackProblem.deleteMany({ where: { round: { eventId } } });
  await prisma.round.deleteMany({ where: { eventId } });
  await prisma.track.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });
}

async function countTeamsPerTrack(eventId: number) {
  const rows = await prisma.team.groupBy({
    by: ["trackId"],
    where: { eventId, status: TeamStatus.approved, trackId: { not: null } },
    _count: true,
  });
  return rows.map((r) => r._count).sort((a, b) => a - b);
}

async function ceremonyTests() {
  console.log("\n=== Ceremony (Flow B) ===");

  await test("3 tracks x 10 teams — even split 3+3+4", async () => {
    const tag = `3t10-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["Alpha", "Beta", "Gamma"],
      teamCount: 10,
      poolCount: 3,
    });
    try {
      const r = await runCeremony(ctx);
      assert(r.assignedCount === 10, `assigned ${r.assignedCount}`);
      const counts = await countTeamsPerTrack(ctx.eventId);
      assert(
        counts.reduce((a, b) => a + b, 0) === 10,
        `total teams ${counts.join(",")}`,
      );
      assert(
        counts.every((c) => c >= 3 && c <= 4),
        `each track 3-4 teams, got ${counts.join(",")}`,
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("5 tracks x 11 teams — spread across all tracks", async () => {
    const tag = `5t11-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["T1", "T2", "T3", "T4", "T5"],
      teamCount: 11,
      poolCount: 5,
    });
    try {
      const r = await runCeremony(ctx);
      assert(r.assignedCount === 11, `assigned ${r.assignedCount}`);
      const counts = await countTeamsPerTrack(ctx.eventId);
      assert(counts.length === 5, `expected 5 tracks used, got ${counts.length}`);
      assert(
        counts.every((c) => c >= 2 && c <= 3),
        `each track 2-3 teams, got ${counts.join(",")}`,
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("maxTeams=6, 3 tracks — assignment allowed", async () => {
    const tag = `cap6-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B", "C"],
      teamCount: 6,
      poolCount: 3,
      maxTeams: 6,
    });
    try {
      const r = await runCeremony(ctx);
      assert(r.assignedCount === 6, `assigned ${r.assignedCount}`);
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("maxTeams=2, 3 tracks — Phase 1 blocked", async () => {
    const tag = `cap2-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B", "C"],
      teamCount: 3,
      poolCount: 3,
      maxTeams: 2,
    });
    try {
      await expectThrow(
        () => poolService.lotteryAssignProblemsToRound(ctx.eventId, ctx.roundId),
        /exceed max teams/i,
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("insufficient pool — Phase 1 rejected", async () => {
    const tag = `pool-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B"],
      teamCount: 2,
      poolCount: 1,
    });
    try {
      await expectThrow(
        () => poolService.lotteryAssignProblemsToRound(ctx.eventId, ctx.roundId),
        /Need at least 2 unassigned pool/i,
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Phase 1 re-run — releases old pool + reassigns", async () => {
    const tag = `rerun-p1-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B"],
      teamCount: 0,
      poolCount: 2,
    });
    try {
      const first = await poolService.lotteryAssignProblemsToRound(
        ctx.eventId,
        ctx.roundId,
      );
      const second = await poolService.lotteryAssignProblemsToRound(
        ctx.eventId,
        ctx.roundId,
      );
      assert(first.assignments.length === 2, "first run");
      assert(second.assignments.length === 2, "second run");
      const rtp = await prisma.roundTrackProblem.findMany({
        where: { roundId: ctx.roundId },
      });
      assert(
        rtp.every((r) => r.problemFileUrl?.trim()),
        "all tracks have problem after rerun",
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Phase 2 sticky — re-run skips assigned teams", async () => {
    const tag = `sticky-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B", "C"],
      teamCount: 9,
      poolCount: 3,
    });
    try {
      await runCeremony(ctx);
      const again = await trackService.assignDeferredTracks(ctx.eventId, {
        roundId: ctx.roundId,
      });
      assert(again.assignedCount === 0, "no reassignment");
      assert(again.skippedAlreadyAssigned === 9, "9 skipped");
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Open-round fallback — assigns late teams only", async () => {
    const tag = `late-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B"],
      teamCount: 4,
      poolCount: 2,
    });
    try {
      await poolService.lotteryAssignProblemsToRound(ctx.eventId, ctx.roundId);
      const first = await trackService.assignDeferredTracks(ctx.eventId, {
        roundId: ctx.roundId,
      });
      assert(first.assignedCount === 4, "initial 4");

      const admin = await prisma.user.findFirst({ where: { role: "admin" } });
      await prisma.team.create({
        data: {
          eventId: ctx.eventId,
          name: `Late-${tag}`,
          status: TeamStatus.approved,
          trackId: null,
          leaderId: admin!.id,
          teamRounds: { create: { roundId: ctx.roundId, status: "competing" } },
        },
      });

      const fallback = await trackService.assignDeferredTracks(ctx.eventId, {
        roundId: ctx.roundId,
      });
      assert(fallback.assignedCount === 1, "one late team assigned");
      assert(fallback.skippedAlreadyAssigned === 4, "4 skipped");
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });
}

async function scoringTests() {
  console.log("\n=== Scoring + publish results (Flow B) ===");

  await test("Full R1: ceremony → submit → score → publish advance", async () => {
    const tag = `score-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["AI", "Web", "Mobile"],
      teamCount: 9,
      poolCount: 3,
    });

    const judge = await prisma.user.findFirst({
      where: { role: "stakeholder" },
      select: { id: true },
    });
    if (!judge) throw new Error("No stakeholder for judge");

    try {
      await runCeremony(ctx);

      const rubricNames = [
        { name: "Technical", weight: 40 },
        { name: "Impact", weight: 30 },
        { name: "Demo", weight: 30 },
      ];
      for (const r of rubricNames) {
        await prisma.criterion.create({
          data: {
            roundId: ctx.roundId,
            trackId: null,
            name: r.name,
            weight: r.weight,
            maxScore: 10,
            createdById: ctx.adminId,
          },
        });
      }

      for (const trackId of ctx.trackIds) {
        await prisma.judgeAssignment.create({
          data: {
            judgeId: judge.id,
            roundId: ctx.roundId,
            trackId,
            assignedById: ctx.adminId,
          },
        });
      }

      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.open },
      });

      const teams = await prisma.team.findMany({
        where: { eventId: ctx.eventId, status: TeamStatus.approved },
      });
      const criteria = await prisma.criterion.findMany({
        where: { roundId: ctx.roundId },
      });

      for (let i = 0; i < teams.length; i++) {
        const sub = await prisma.submission.create({
          data: {
            teamId: teams[i].id,
            roundId: ctx.roundId,
            submittedById: ctx.adminId,
            status: SubmissionStatus.submitted,
            fileUrl: `${PDF}?sub=${i}`,
            submittedAt: new Date(Date.now() - i * 1000),
          },
        });
        for (const c of criteria) {
          await prisma.score.create({
            data: {
              submissionId: sub.id,
              judgeId: judge.id,
              criterionId: c.id,
              scoreValue: 5 + (i % 5),
              comment: "suite test",
            },
          });
        }
      }

      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.closed },
      });

      await prisma.round.create({
        data: {
          eventId: ctx.eventId,
          roundNumber: 2,
          name: `R2 ${tag}`,
          submissionType: "file",
          status: RoundStatus.not_started,
          isTrackSpecific: true,
          submissionDeadline: new Date(Date.now() + 14 * 864e5),
          maxFileSizeMb: 50,
        },
      });

      const result = await rankingService.publishRoundResults(
        ctx.eventId,
        ctx.roundId,
        { advanceCount: 2 },
      );

      assert(result.advancingTeamIds.length > 0, "some teams advanced");
      const advanced = await prisma.teamRound.count({
        where: { roundId: ctx.roundId, status: "advanced" },
      });
      assert(advanced > 0, `advanced count ${advanced}`);
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Publish blocked when round not closed", async () => {
    const tag = `pub-open-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["Only"],
      teamCount: 2,
      poolCount: 1,
    });
    try {
      await runCeremony(ctx);
      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.open },
      });
      await expectThrow(
        () =>
          rankingService.publishRoundResults(ctx.eventId, ctx.roundId, {
            advanceCount: 1,
          }),
        /must be closed/i,
      );
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Per-track ranking — entries per track after scoring", async () => {
    const tag = `rank-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["X", "Y"],
      teamCount: 4,
      poolCount: 2,
    });
    const judge = await prisma.user.findFirst({
      where: { role: "stakeholder" },
      select: { id: true },
    });
    if (!judge) throw new Error("No judge");

    try {
      await runCeremony(ctx);
      await prisma.criterion.create({
        data: {
          roundId: ctx.roundId,
          trackId: null,
          name: "Overall",
          weight: 100,
          maxScore: 10,
          createdById: ctx.adminId,
        },
      });
      for (const trackId of ctx.trackIds) {
        await prisma.judgeAssignment.create({
          data: {
            judgeId: judge.id,
            roundId: ctx.roundId,
            trackId,
            assignedById: ctx.adminId,
          },
        });
      }

      const teams = await prisma.team.findMany({ where: { eventId: ctx.eventId } });
      const crit = await prisma.criterion.findFirst({ where: { roundId: ctx.roundId } });
      assert(crit, "criterion");

      for (let i = 0; i < teams.length; i++) {
        const sub = await prisma.submission.create({
          data: {
            teamId: teams[i].id,
            roundId: ctx.roundId,
            submittedById: ctx.adminId,
            status: SubmissionStatus.submitted,
            fileUrl: PDF,
            submittedAt: new Date(),
          },
        });
        await prisma.score.create({
          data: {
            submissionId: sub.id,
            judgeId: judge.id,
            criterionId: crit!.id,
            scoreValue: i === 0 ? 10 : i === 1 ? 9 : i === 2 ? 8 : 1,
          },
        });
      }

      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.closed },
      });
      await prisma.round.create({
        data: {
          eventId: ctx.eventId,
          roundNumber: 2,
          name: "R2",
          submissionType: "file",
          status: RoundStatus.not_started,
          isTrackSpecific: true,
          submissionDeadline: new Date(Date.now() + 864e5),
          maxFileSizeMb: 50,
        },
      });

      const preview = await rankingService.getRoundRankings(ctx.eventId, ctx.roundId);
      assert(preview.tracks.length === 2, "2 track rankings");
      for (const tr of preview.tracks) {
        assert(tr.entries.length >= 1, `track ${tr.track.name} has entries`);
      }
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Multi-track advance — top 2 per track (3 tracks → 6 advanced)", async () => {
    const tag = `adv2-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["A", "B", "C"],
      teamCount: 9,
      poolCount: 3,
    });
    const judge = await prisma.user.findFirst({
      where: { role: "stakeholder" },
      select: { id: true },
    });
    if (!judge) throw new Error("No judge");

    try {
      await runCeremony(ctx);
      await prisma.criterion.create({
        data: {
          roundId: ctx.roundId,
          trackId: null,
          name: "Overall",
          weight: 100,
          maxScore: 10,
          createdById: ctx.adminId,
        },
      });
      for (const trackId of ctx.trackIds) {
        await prisma.judgeAssignment.create({
          data: {
            judgeId: judge.id,
            roundId: ctx.roundId,
            trackId,
            assignedById: ctx.adminId,
          },
        });
      }

      const teams = await prisma.team.findMany({
        where: { eventId: ctx.eventId },
        orderBy: { id: "asc" },
      });
      const crit = await prisma.criterion.findFirst({ where: { roundId: ctx.roundId } });
      assert(crit, "criterion");

      for (let i = 0; i < teams.length; i++) {
        const sub = await prisma.submission.create({
          data: {
            teamId: teams[i].id,
            roundId: ctx.roundId,
            submittedById: ctx.adminId,
            status: SubmissionStatus.submitted,
            fileUrl: PDF,
            submittedAt: new Date(Date.now() - i * 1000),
          },
        });
        await prisma.score.create({
          data: {
            submissionId: sub.id,
            judgeId: judge.id,
            criterionId: crit!.id,
            scoreValue: 10 - (i % 3),
          },
        });
      }

      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.closed },
      });
      await prisma.round.create({
        data: {
          eventId: ctx.eventId,
          roundNumber: 2,
          name: "R2",
          submissionType: "file",
          status: RoundStatus.not_started,
          isTrackSpecific: true,
          submissionDeadline: new Date(Date.now() + 864e5),
          maxFileSizeMb: 50,
        },
      });

      const result = await rankingService.publishRoundResults(
        ctx.eventId,
        ctx.roundId,
        { advanceCount: 2 },
      );
      assert(result.advancingTeamIds.length === 6, `expected 6 advanced, got ${result.advancingTeamIds.length}`);
      for (const s of result.summary ?? []) {
        assert(s.advancedTeamIds.length === 2, `track ${s.trackName} should advance 2`);
      }
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("No submission → eliminated on publish (not in advance list)", async () => {
    const tag = `nosub-${Date.now()}`;
    const ctx = await createFlowBBase({
      tag,
      trackNames: ["Only"],
      teamCount: 3,
      poolCount: 1,
    });
    const judge = await prisma.user.findFirst({
      where: { role: "stakeholder" },
      select: { id: true },
    });
    if (!judge) throw new Error("No judge");

    try {
      await runCeremony(ctx);
      await prisma.criterion.create({
        data: {
          roundId: ctx.roundId,
          trackId: null,
          name: "Overall",
          weight: 100,
          maxScore: 10,
          createdById: ctx.adminId,
        },
      });
      await prisma.judgeAssignment.create({
        data: {
          judgeId: judge.id,
          roundId: ctx.roundId,
          trackId: ctx.trackIds[0],
          assignedById: ctx.adminId,
        },
      });

      const teams = await prisma.team.findMany({ where: { eventId: ctx.eventId } });
      const crit = await prisma.criterion.findFirst({ where: { roundId: ctx.roundId } });
      const sub = await prisma.submission.create({
        data: {
          teamId: teams[0].id,
          roundId: ctx.roundId,
          submittedById: ctx.adminId,
          status: SubmissionStatus.submitted,
          fileUrl: PDF,
          submittedAt: new Date(),
        },
      });
      await prisma.score.create({
        data: {
          submissionId: sub.id,
          judgeId: judge.id,
          criterionId: crit!.id,
          scoreValue: 9,
        },
      });

      await prisma.round.update({
        where: { id: ctx.roundId },
        data: { status: RoundStatus.closed },
      });
      await prisma.round.create({
        data: {
          eventId: ctx.eventId,
          roundNumber: 2,
          name: "R2",
          submissionType: "file",
          status: RoundStatus.not_started,
          isTrackSpecific: true,
          submissionDeadline: new Date(Date.now() + 864e5),
          maxFileSizeMb: 50,
        },
      });

      const result = await rankingService.publishRoundResults(
        ctx.eventId,
        ctx.roundId,
        { advanceCount: 2 },
      );
      assert(result.advancingTeamIds.length === 1, "only scored team can advance");
      const eliminated = await prisma.teamRound.findMany({
        where: { roundId: ctx.roundId, status: "eliminated" },
      });
      assert(eliminated.length === 2, `2 no-submit teams eliminated, got ${eliminated.length}`);
    } finally {
      await cleanupEvent(ctx.eventId);
    }
  });

  await test("Shared round (not track-specific) — pooled global advance", async () => {
    const tag = `pool-adv-${Date.now()}`;
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!admin) throw new Error("No admin");

    const event = await prisma.event.create({
      data: {
        name: `Shared ${tag}`,
        season: "Summer",
        year: 2026,
        status: "active",
        deferredTrackAssignment: false,
        createdById: admin.id,
      },
    });
    const t1 = await prisma.track.create({ data: { eventId: event.id, name: "T1" } });
    const t2 = await prisma.track.create({ data: { eventId: event.id, name: "T2" } });
    const round = await prisma.round.create({
      data: {
        eventId: event.id,
        roundNumber: 1,
        name: "Shared R1",
        submissionType: "file",
        status: RoundStatus.closed,
        isTrackSpecific: false,
        problemFileUrl: PDF,
        submissionDeadline: new Date(Date.now() + 864e5),
        maxFileSizeMb: 50,
      },
    });
    const judge = await prisma.user.findFirst({ where: { role: "stakeholder" } });
    if (!judge) throw new Error("No judge");

    try {
      const crit = await prisma.criterion.create({
        data: {
          roundId: round.id,
          trackId: null,
          name: "Overall",
          weight: 100,
          maxScore: 10,
          createdById: admin.id,
        },
      });
      await prisma.judgeAssignment.create({
        data: {
          judgeId: judge.id,
          roundId: round.id,
          trackId: null,
          assignedById: admin.id,
        },
      });

      for (const [track, score] of [
        [t1, 10],
        [t2, 5],
      ] as const) {
        const team = await prisma.team.create({
          data: {
            eventId: event.id,
            name: `Team-${track.id}-${tag}`,
            trackId: track.id,
            status: TeamStatus.approved,
            leaderId: admin.id,
            teamRounds: { create: { roundId: round.id, status: "competing" } },
          },
        });
        const sub = await prisma.submission.create({
          data: {
            teamId: team.id,
            roundId: round.id,
            submittedById: admin.id,
            status: SubmissionStatus.submitted,
            fileUrl: PDF,
            submittedAt: new Date(),
          },
        });
        await prisma.score.create({
          data: {
            submissionId: sub.id,
            judgeId: judge.id,
            criterionId: crit.id,
            scoreValue: score,
          },
        });
      }

      await prisma.round.create({
        data: {
          eventId: event.id,
          roundNumber: 2,
          name: "R2",
          submissionType: "file",
          status: RoundStatus.not_started,
          isTrackSpecific: false,
          submissionDeadline: new Date(Date.now() + 864e5),
          maxFileSizeMb: 50,
        },
      });

      const result = await rankingService.publishRoundResults(event.id, round.id, {
        advanceCount: 1,
      });
      assert(result.advancingTeamIds.length === 1, "global top 1 only");
      const advancedTeam = await prisma.team.findUnique({
        where: { id: result.advancingTeamIds[0] },
      });
      assert(advancedTeam?.trackId === t1.id, "highest score track T1 advances");
    } finally {
      await prisma.score.deleteMany({ where: { submission: { round: { eventId: event.id } } } });
      await prisma.submission.deleteMany({ where: { round: { eventId: event.id } } });
      await prisma.team.deleteMany({ where: { eventId: event.id } });
      await prisma.criterion.deleteMany({ where: { round: { eventId: event.id } } });
      await prisma.judgeAssignment.deleteMany({ where: { round: { eventId: event.id } } });
      await prisma.round.deleteMany({ where: { eventId: event.id } });
      await prisma.track.deleteMany({ where: { eventId: event.id } });
      await prisma.event.delete({ where: { id: event.id } });
    }
  });
}

async function main() {
  console.log("Flow B + Scoring integration suite");
  await ceremonyTests();
  await scoringTests();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
