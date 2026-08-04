import { PrismaClient, RoundStatus, TeamStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const prisma = new PrismaClient();
export const API = process.env.API_BASE || "http://localhost:3000/api";
export const PASS = "Admin@123";
export const STUDENT_PASS = "Student@123";
export const ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || "12345678";
export const DUMMY_PDF =
  "https://hackathon-submissions.sgp1.digitaloceanspaces.com/general/e2e-demo-problem.pdf";

export const E2E = {
  org: "e2e.org@test.com",
  mentorJudge: "e2e.mentorjudge@test.com",
  judge: "e2e.judge@test.com",
  admin: "admin@gmail.com",
  students: Array.from({ length: 6 }, (_, i) => `e2e.student${i + 1}@test.com`),
};

export const log = (...args: unknown[]) => console.log(...args);
export const fail = (msg: string, detail?: unknown): never => {
  console.error("FAIL:", msg, detail ?? "");
  throw new Error(msg);
};

export function getTargetEventId(): number {
  const raw = process.env.TARGET_EVENT_ID;
  if (!raw) {
    fail(
      "TARGET_EVENT_ID is required. Open an event in the organizer workspace and run from the E2E panel (Admin only).",
    );
  }
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id < 1) fail(`Invalid TARGET_EVENT_ID: ${raw}`);
  return id;
}

export async function api<T = unknown>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: { data?: T; message?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const err = new Error(
      `${method} ${path} → ${res.status}: ${data?.message || text}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (data?.data !== undefined ? data.data : data) as T;
}

/** Admin can manage any event during live demo. */
export async function organizerToken(): Promise<string> {
  return signIn(E2E.admin, ADMIN_PASS);
}

export async function signIn(email: string, password = PASS): Promise<string> {
  const auth = await api<{ accessToken?: string; token?: string }>(
    "POST",
    "/auth/signin",
    { body: { email, password } },
  );
  const token = auth.accessToken || auth.token;
  if (!token) fail("No access token from signin", auth);
  return token;
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: string;
  password?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  const passwordHash = existing
    ? undefined
    : await bcrypt.hash(opts.password ?? PASS, 10);

  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      isActive: true,
      role: opts.role as never,
      name: opts.name,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: opts.email,
      name: opts.name,
      passwordHash: passwordHash!,
      role: opts.role as never,
      isActive: true,
    },
  });
  if (opts.role === "stakeholder") {
    await prisma.stakeholderProfile.upsert({
      where: { userId: user.id },
      update: {
        jobTitle: "Senior Engineer",
        organization: "SEAL Demo Co",
        experience: "5+ years",
        bio: "Demo stakeholder",
      },
      create: {
        userId: user.id,
        jobTitle: "Senior Engineer",
        organization: "SEAL Demo Co",
        experience: "5+ years",
        bio: "Demo stakeholder",
      },
    });
  }
  return user;
}

export async function loadEvent(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tracks: { orderBy: { id: "asc" } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: { trackProblems: true },
      },
      prizes: true,
    },
  });
  if (!event) fail(`Event ${eventId} not found`);
  return event;
}

export async function seedUsers() {
  log("=== [01] Seed demo users ===");
  await upsertUser({ email: E2E.admin, name: "Admin", role: "admin", password: ADMIN_PASS });
  await upsertUser({ email: E2E.org, name: "E2E Organizer", role: "organizer" });
  await upsertUser({
    email: E2E.mentorJudge,
    name: "Dual MentorJudge",
    role: "stakeholder",
  });
  await upsertUser({
    email: E2E.judge,
    name: "E2E Judge Only",
    role: "stakeholder",
  });
  for (let i = 0; i < E2E.students.length; i++) {
    await upsertUser({
      email: E2E.students[i],
      name: `E2E Student ${i + 1}`,
      role: "student",
      password: STUDENT_PASS,
    });
  }
  log("OK demo accounts ready (existing passwords kept unchanged)");
}

const DEMO_TEAM_NAMES = [
  "ChickenWinner",
  "Hacker Lords",
  "Code Crushers",
  "Byte Warriors",
  "Null Pointers",
  "Syntax Squad",
];

/** Step 02 — create pending teams only (show on Teams tab before approve). */
export async function createDemoTeams() {
  const eventId = getTargetEventId();
  log(`=== [02] Create pending teams (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Event needs Round 1");

  const students = await Promise.all(
    E2E.students.map((email) => prisma.user.findUnique({ where: { email } })),
  );
  const validStudents = students.filter(Boolean);
  if (!validStudents.length) fail("Run 01-seed-users first");

  let created = 0;
  let trackToggle = 0;

  for (let i = 0; i < validStudents.length; i++) {
    const student = validStudents[i]!;
    const alreadyInEvent = await prisma.teamMember.findFirst({
      where: { userId: student.id, team: { eventId } },
    });
    if (alreadyInEvent) {
      log(`Skip ${student.email} — already in an event team`);
      continue;
    }

    const track =
      !event.deferredTrackAssignment && event.tracks.length
        ? event.tracks[trackToggle++ % event.tracks.length]
        : null;

    const team = await prisma.team.create({
      data: {
        name: DEMO_TEAM_NAMES[i % DEMO_TEAM_NAMES.length],
        eventId,
        trackId: track?.id ?? null,
        status: TeamStatus.pending,
        leaderId: student.id,
        members: {
          create: {
            userId: student.id,
            role: "leader",
            status: "accepted",
          },
        },
      },
    });
    log(`Created pending: ${team.name}${track ? ` (${track.name})` : ""}`);
    created++;
  }

  if (!created) log("No new teams — demo students may already be registered");
  else log(`OK ${created} pending team(s) — refresh Teams tab (chưa duyệt)`);
}

/** Step 03 — approve pending teams only (run on Teams slide). */
export async function approveTeams() {
  const eventId = getTargetEventId();
  log(`=== [03] Approve pending teams (event ${eventId}) ===`);
  const orgToken = await organizerToken();

  const pending = await prisma.team.findMany({
    where: { eventId, status: TeamStatus.pending },
    select: { id: true, name: true },
  });
  if (!pending.length) {
    log("No pending teams — run 02-create-teams or approve manually");
    return;
  }

  await api("POST", "/organizer/teams/bulk-status", {
    token: orgToken,
    body: {
      teamIds: pending.map((t) => t.id),
      status: TeamStatus.approved,
    },
  });
  log(`OK approved ${pending.length} team(s):`, pending.map((t) => t.name).join(", "));

  const round1 = (await loadEvent(eventId)).rounds.find((r) => r.roundNumber === 1);
  if (round1) {
    for (const t of pending) {
      await prisma.teamRound.upsert({
        where: { teamId_roundId: { teamId: t.id, roundId: round1.id } },
        update: { status: "competing" },
        create: { teamId: t.id, roundId: round1.id, status: "competing" },
      });
    }
  }
}

/** Step 04 — Flow B: reveal deferred tracks after approval. */
export async function revealTracks() {
  const eventId = getTargetEventId();
  log(`=== [04] Reveal tracks (event ${eventId}) ===`);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { deferredTrackAssignment: true, tracks: { select: { id: true } } },
  });
  if (!event?.deferredTrackAssignment) {
    log("Skip — not deferred track assignment (Flow A)");
    return;
  }
  const untracked = await prisma.team.count({
    where: { eventId, status: TeamStatus.approved, trackId: null },
  });
  if (!untracked) {
    log("All approved teams already have tracks");
    return;
  }
  if (!event.tracks.length) fail("Add catalog tracks before reveal");

  const token = await organizerToken();
  await api("POST", `/organizer/events/${eventId}/tracks/reveal`, {
    token,
    body: {},
  });
  log(`OK revealed tracks for ${untracked} team(s)`);
}

export async function assignStakeholders() {
  const eventId = getTargetEventId();
  log(`=== [05] Assign mentor & judges (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const orgToken = await organizerToken();
  const mentorJudge = await prisma.user.findUnique({
    where: { email: E2E.mentorJudge },
  });
  const judgeOnly = await prisma.user.findUnique({ where: { email: E2E.judge } });
  if (!mentorJudge || !judgeOnly) fail("Run 01-seed-users first");

  const teams = await prisma.team.findMany({
    where: { eventId, status: TeamStatus.approved },
    orderBy: { id: "asc" },
  });
  if (!teams.length) fail("No approved teams — run 03-approve-teams first");

  const mentoredTeam = teams[0];
  const existingMentor = await prisma.mentorAssignment.findFirst({
    where: { teamId: mentoredTeam.id, mentorId: mentorJudge.id },
  });
  if (!existingMentor) {
    await api("POST", `/organizer/assignments/teams/${mentoredTeam.id}/mentors`, {
      token: orgToken,
      body: { stakeholderId: mentorJudge.id },
    });
    log(`OK mentor ${E2E.mentorJudge} → ${mentoredTeam.name}`);
  } else {
    log("Mentor assignment already exists");
  }

  for (const round of event.rounds) {
    const requireTrackScope =
      round.isTrackSpecific || Boolean(event.deferredTrackAssignment);
    let trackIds: number[] | undefined;
    if (requireTrackScope) {
      trackIds = event.tracks.map((t) => t.id);
      if (!trackIds.length) {
        fail(
          `Round "${round.name}": add catalog tracks to the event first.`,
        );
      }
    }

    for (const judge of [mentorJudge, judgeOnly]) {
      const existing = await prisma.judgeAssignment.findMany({
        where: { judgeId: judge.id, roundId: round.id },
      });
      if (requireTrackScope) {
        const covered = new Set(
          existing.map((a) => a.trackId).filter((id): id is number => id != null),
        );
        const missing = trackIds!.filter((id) => !covered.has(id));
        if (missing.length === 0 && existing.length > 0) {
          log(`Judge ${judge.email} already on all tracks for ${round.name}`);
          continue;
        }
      } else if (existing.some((a) => a.trackId == null)) {
        log(`Judge ${judge.email} already on ${round.name}`);
        continue;
      }

      await api("POST", `/organizer/assignments/events/${eventId}/judges`, {
        token: orgToken,
        body: {
          stakeholderIds: [judge.id],
          roundId: round.id,
          ...(trackIds?.length ? { trackIds } : {}),
        },
      });
      log(`OK judge ${judge.email} → ${round.name}`);
    }
  }
}

const RUBRIC_DEFS = [
  { name: "Technical", weight: 40, description: "Implementation quality" },
  { name: "Impact", weight: 30, description: "Problem fit & impact" },
  { name: "Presentation", weight: 30, description: "Demo & clarity" },
];

export async function setupRubrics() {
  const eventId = getTargetEventId();
  log(`=== [06] Setup rubrics (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const org = await prisma.user.findUnique({ where: { email: E2E.org } });
  if (!org) fail("Run 01-seed-users first");

  for (const round of event.rounds) {
    const existing = await prisma.criterion.findMany({
      where: { roundId: round.id, trackId: null },
    });
    if (existing.length >= RUBRIC_DEFS.length) {
      log(`Round ${round.name}: rubrics already exist (${existing.length})`);
      continue;
    }
    for (const r of RUBRIC_DEFS) {
      const dup = existing.find((c) => c.name === r.name);
      if (dup) continue;
      await prisma.criterion.create({
        data: {
          name: r.name,
          description: r.description,
          maxScore: 10,
          weight: r.weight,
          roundId: round.id,
          trackId: null,
          createdById: org.id,
        },
      });
      log(`Round ${round.name}: + ${r.name} (${r.weight}%)`);
    }
  }
}

export async function ensureRoundProblems(eventId: number) {
  const event = await loadEvent(eventId);
  for (const round of event.rounds) {
    if (!round.isTrackSpecific) {
      if (!round.problemFileUrl?.trim()) {
        await prisma.round.update({
          where: { id: round.id },
          data: { problemFileUrl: DUMMY_PDF },
        });
        log(`Round ${round.name}: set shared problem file`);
      }
      continue;
    }

    let scoped = round.trackProblems;
    if (!scoped.length && event.tracks.length) {
      for (const track of event.tracks) {
        await prisma.roundTrackProblem.create({
          data: {
            roundId: round.id,
            trackId: track.id,
            problemFileUrl: DUMMY_PDF,
          },
        });
      }
      log(`Round ${round.name}: scoped ${event.tracks.length} catalog track(s)`);
      scoped = await prisma.roundTrackProblem.findMany({
        where: { roundId: round.id },
      });
    }

    for (const tp of scoped) {
      if (!tp.problemFileUrl?.trim()) {
        await prisma.roundTrackProblem.update({
          where: { id: tp.id },
          data: { problemFileUrl: DUMMY_PDF },
        });
      }
    }
  }
}

export async function openRound1() {
  const eventId = getTargetEventId();
  log(`=== [07] Open Round 1 (event ${eventId}) ===`);
  await ensureRoundProblems(eventId);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Round 1 not found");

  if (round1.status !== RoundStatus.not_started) {
    log(`Round 1 already ${round1.status} — skip`);
    return;
  }

  const orgToken = await organizerToken();
  await api("PATCH", `/organizer/events/${eventId}/rounds/${round1.id}/status`, {
    token: orgToken,
    body: { status: RoundStatus.open },
  });
  log("OK Round 1 opened — refresh round workspace");
}

export async function submitRound1() {
  const eventId = getTargetEventId();
  log(`=== [08] Submit Round 1 (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Round 1 not found");

  if (round1.status === RoundStatus.not_started) {
    fail("Run 07-open-r1 first");
  }

  const teams = await prisma.team.findMany({
    where: { eventId, status: TeamStatus.approved },
  });
  if (!teams.length) fail("No approved teams");

  let count = 0;
  for (const team of teams) {
    await prisma.teamRound.upsert({
      where: { teamId_roundId: { teamId: team.id, roundId: round1.id } },
      update: { status: "competing" },
      create: { teamId: team.id, roundId: round1.id, status: "competing" },
    });

    const exists = await prisma.submission.findFirst({
      where: { teamId: team.id, roundId: round1.id },
    });
    if (exists) {
      log(`Skip ${team.name} — already submitted`);
      continue;
    }

    await prisma.submission.create({
      data: {
        teamId: team.id,
        roundId: round1.id,
        submittedById: team.leaderId,
        status: "submitted",
        fileUrl: `https://example.com/e2e-${team.id}-r1.pdf`,
        description: `E2E submission ${team.name}`,
        submittedAt: new Date(),
      },
    });
    log(`OK submission: ${team.name}`);
    count++;
  }
  log(count ? `Created ${count} submission(s)` : "All teams already submitted");
}

export async function scoreRound1() {
  const eventId = getTargetEventId();
  log(`=== [09] Score Round 1 (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Round 1 not found");

  const orgToken = await organizerToken();
  if (round1.status === RoundStatus.open) {
    await api("PATCH", `/organizer/events/${eventId}/rounds/${round1.id}/status`, {
      token: orgToken,
      body: { status: RoundStatus.closed },
    });
    log("OK Round 1 closed");
  }

  const criteria = await prisma.criterion.findMany({
    where: { roundId: round1.id, trackId: null },
    orderBy: { id: "asc" },
  });
  if (criteria.length < 3) fail("Run 06-setup-rubrics first");

  const teams = await prisma.team.findMany({
    where: { eventId, status: TeamStatus.approved },
    orderBy: { id: "asc" },
  });
  const mentoredTeam = teams[0];
  const subs = await prisma.submission.findMany({
    where: { roundId: round1.id },
    include: { team: true },
  });
  if (!subs.length) fail("Run 08-submit-r1 first");

  const mjToken = await signIn(E2E.mentorJudge);
  const jToken = await signIn(E2E.judge);

  const mentoredSub = subs.find((s) => s.teamId === mentoredTeam.id);
  if (mentoredSub) {
    let blocked = false;
    try {
      await api("PUT", `/judge/submissions/${mentoredSub.id}/scores`, {
        token: mjToken,
        body: {
          scores: criteria.map((c) => ({
            criterionId: c.id,
            scoreValue: 8,
            comment: "should fail — mentor conflict",
          })),
        },
      });
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403 && /mentor/i.test(String(err.message))) {
        blocked = true;
        log("OK mentor-judge blocked from scoring mentored team");
      } else {
        throw e;
      }
    }
    if (!blocked) fail("Expected 403 when mentor scores mentored team");
  }

  const scorePayload = (base: number) =>
    criteria.map((c, idx) => ({
      criterionId: c.id,
      scoreValue: Math.min(10, Math.max(1, base + idx)),
      comment: "e2e demo score",
    }));

  for (const sub of subs) {
    if (sub.teamId === mentoredTeam.id) continue;
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: mjToken,
      body: { scores: scorePayload(6) },
    });
  }
  for (let i = 0; i < subs.length; i++) {
    await api("PUT", `/judge/submissions/${subs[i].id}/scores`, {
      token: jToken,
      body: { scores: scorePayload(9 - i) },
    });
  }
  log(`OK scored ${subs.length} submission(s)`);
}

export async function publishRound1() {
  const eventId = getTargetEventId();
  log(`=== [10] Publish Round 1 (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Round 1 not found");
  const orgToken = await organizerToken();

  const result = await api<{ advancingTeamIds?: number[] }>(
    "POST",
    `/organizer/events/${eventId}/rounds/${round1.id}/publish-results`,
    { token: orgToken, body: { advanceCount: 1 } },
  );
  log("OK published — advanced:", result.advancingTeamIds?.length ?? 0, "team(s)");
}

export async function openRound2() {
  const eventId = getTargetEventId();
  log(`=== [11] Open Round 2 (event ${eventId}) ===`);
  await ensureRoundProblems(eventId);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  if (!round1 || !round2) fail("Need Round 1 and Round 2");

  if (round1.status !== RoundStatus.results_published) {
    fail("Run 10-publish-r1 first");
  }
  if (round2.status !== RoundStatus.not_started) {
    log(`Round 2 already ${round2.status} — skip`);
    return;
  }

  const orgToken = await organizerToken();
  await api("PATCH", `/organizer/events/${eventId}/rounds/${round2.id}/status`, {
    token: orgToken,
    body: { status: RoundStatus.open },
  });
  log("OK Round 2 opened");
}

export async function submitRound2() {
  const eventId = getTargetEventId();
  log(`=== [12] Submit Round 2 (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  if (!round2) fail("Round 2 not found");

  if (round2.status === RoundStatus.not_started) {
    fail("Run 11-open-r2 first");
  }

  const competing = await prisma.teamRound.findMany({
    where: { roundId: round2.id, status: "competing" },
    include: { team: true },
  });
  if (!competing.length) fail("No teams in Round 2");

  let count = 0;
  for (const tr of competing) {
    const exists = await prisma.submission.findFirst({
      where: { teamId: tr.teamId, roundId: round2.id },
    });
    if (exists) {
      log(`Skip ${tr.team.name} — already submitted`);
      continue;
    }
    await prisma.submission.create({
      data: {
        teamId: tr.teamId,
        roundId: round2.id,
        submittedById: tr.team.leaderId,
        status: "submitted",
        fileUrl: `https://example.com/e2e-${tr.teamId}-r2.pdf`,
        description: `Finals ${tr.team.name}`,
        submittedAt: new Date(),
      },
    });
    log(`OK submission: ${tr.team.name}`);
    count++;
  }
  log(count ? `Created ${count} R2 submission(s)` : "All finalists already submitted");
}

export async function scoreRound2() {
  const eventId = getTargetEventId();
  log(`=== [13] Score Round 2 (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  if (!round2) fail("Round 2 not found");

  const orgToken = await organizerToken();
  if (round2.status === RoundStatus.open) {
    await api("PATCH", `/organizer/events/${eventId}/rounds/${round2.id}/status`, {
      token: orgToken,
      body: { status: RoundStatus.closed },
    });
    log("OK Round 2 closed");
  }

  const criteria = await prisma.criterion.findMany({
    where: { roundId: round2.id, trackId: null },
    orderBy: { id: "asc" },
  });
  if (!criteria.length) fail("Run 06-setup-rubrics first");

  const r2Subs = await prisma.submission.findMany({ where: { roundId: round2.id } });
  if (!r2Subs.length) fail("Run 12-submit-r2 first");

  const mentoredTeamId = (
    await prisma.team.findFirst({
      where: { eventId, status: TeamStatus.approved },
      orderBy: { id: "asc" },
    })
  )?.id;

  const mjToken = await signIn(E2E.mentorJudge);
  const jToken = await signIn(E2E.judge);

  for (const sub of r2Subs) {
    const payload = criteria.map((c, idx) => ({
      criterionId: c.id,
      scoreValue: Math.min(10, 7 + idx),
      comment: "r2 e2e",
    }));
    if (sub.teamId !== mentoredTeamId) {
      await api("PUT", `/judge/submissions/${sub.id}/scores`, {
        token: mjToken,
        body: { scores: payload },
      });
    }
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: jToken,
      body: { scores: payload },
    });
  }
  log(`OK scored ${r2Subs.length} R2 submission(s)`);
}

export async function publishRound2() {
  const eventId = getTargetEventId();
  log(`=== [14] Publish Round 2 / awards (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  if (!round2) fail("Round 2 not found");
  const orgToken = await organizerToken();

  const pub = await api<{ awards?: unknown[] }>(
    "POST",
    `/organizer/events/${eventId}/rounds/${round2.id}/publish-results`,
    { token: orgToken, body: {} },
  );
  log("OK finals published, awards:", pub.awards?.length ?? 0);

  const awarded = await prisma.team.count({
    where: { eventId, awardId: { not: null } },
  });
  log(`Teams with prizes: ${awarded}`);
}

export async function disconnect() {
  await prisma.$disconnect();
}
