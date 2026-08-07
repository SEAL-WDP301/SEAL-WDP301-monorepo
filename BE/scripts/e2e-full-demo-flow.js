/**
 * Full demo flow against current product rules:
 * event → students/teams → rubrics (round-global %) → mentor+judge dual role
 * → open R1 → submit → score (incl. mentor conflict) → publish advanceCount
 * → R2 → score → publish prizes
 *
 * Run: node scripts/e2e-full-demo-flow.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const API = process.env.API_BASE || "http://localhost:3000/api";
const PASS = process.env.E2E_DEFAULT_PASSWORD || "";

const log = (...a) => console.log(...a);
const fail = (msg, detail) => {
  console.error("FAIL:", msg, detail || "");
  throw new Error(msg);
};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `${method} ${path} → ${res.status}: ${data?.message || text}`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data?.data !== undefined ? data.data : data;
}

async function upsertUser({ email, name, role, password = PASS }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, role, name },
    create: { email, name, passwordHash, role, isActive: true },
  });
  if (role === "stakeholder") {
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

async function main() {
  log("=== E2E full demo flow ===");

  // 0) Users
  const admin = await upsertUser({
    email: "admin@gmail.com",
    name: "Admin",
    role: "admin",
  });
  const org = await upsertUser({
    email: "e2e.org@test.com",
    name: "E2E Organizer",
    role: "organizer",
  });
  const mentorJudge = await upsertUser({
    email: "e2e.mentorjudge@test.com",
    name: "Dual MentorJudge",
    role: "stakeholder",
  });
  const judgeOnly = await upsertUser({
    email: "e2e.judge@test.com",
    name: "E2E Judge Only",
    role: "stakeholder",
  });

  const students = [];
  for (let i = 1; i <= 6; i++) {
    students.push(
      await upsertUser({
        email: `e2e.student${i}@test.com`,
        name: `E2E Student ${i}`,
        role: "student",
        password: PASS,
      }),
    );
  }
  log("users ok", { admin: admin.id, org: org.id, mentorJudge: mentorJudge.id });

  // 1) Event + tracks + rounds + prizes
  const stamp = Date.now();
  const event = await prisma.event.create({
    data: {
      name: `E2E Demo Flow ${stamp}`,
      description: "Auto-seeded event for full flow test",
      season: "Fall",
      year: 2026,
      status: "active",
      deferredTrackAssignment: false,
      minMembersPerTeam: 1,
      maxMembersPerTeam: 4,
      registrationDeadline: new Date(Date.now() + 7 * 864e5),
      startDate: new Date(Date.now() - 864e5),
      endDate: new Date(Date.now() + 30 * 864e5),
      createdById: org.id,
      tracks: {
        create: [
          { name: "AI Track", description: "AI/ML challenges" },
          { name: "Web Track", description: "Full-stack web" },
        ],
      },
      rounds: {
        create: [
          {
            roundNumber: 1,
            name: "Qualifier",
            status: "not_started",
            submissionType: "file",
            isTrackSpecific: true,
            submissionDeadline: new Date(Date.now() + 2 * 864e5),
            problemFileUrl: "https://example.com/r1-problem.pdf",
          },
          {
            roundNumber: 2,
            name: "Finals",
            status: "not_started",
            submissionType: "file",
            isTrackSpecific: false,
            submissionDeadline: new Date(Date.now() + 10 * 864e5),
            problemFileUrl: "https://example.com/r2-problem.pdf",
          },
        ],
      },
      prizes: {
        create: [
          {
            name: "Champion",
            quantity: 1,
            amount: 10000000,
            placement: 1,
            currency: "VND",
          },
          {
            name: "Runner-up",
            quantity: 1,
            amount: 5000000,
            placement: 2,
            currency: "VND",
          },
          {
            name: "Third Place",
            quantity: 1,
            amount: 2000000,
            placement: 3,
            currency: "VND",
          },
        ],
      },
    },
    include: { tracks: true, rounds: true, prizes: true },
  });

  const tracks = event.tracks.sort((a, b) => a.id - b.id);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  log("event", event.id, tracks.map((t) => t.name).join(" / "));

  // Per-track đề for track-specific Round 1
  for (const track of tracks) {
    await prisma.roundTrackProblem.create({
      data: {
        roundId: round1.id,
        trackId: track.id,
        problemFileUrl: `https://example.com/r1-${track.id}.pdf`,
      },
    });
  }

  // 2) Rubrics — per round, trackId null, weights = 100
  const rubricDefs = [
    { name: "Technical", weight: 40, description: "Implementation quality" },
    { name: "Impact", weight: 30, description: "Problem fit & impact" },
    { name: "Presentation", weight: 30, description: "Demo & clarity" },
  ];
  for (const round of [round1, round2]) {
    for (const r of rubricDefs) {
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
    }
  }
  log("rubrics ok (3 × 2 rounds, 100% each)");

  // 3) Registrations + teams (3 AI, 3 Web)
  const teams = [];
  for (let i = 0; i < 6; i++) {
    const student = students[i];
    const track = tracks[i % 2];
    await prisma.studentRegistration.create({
      data: {
        userId: student.id,
        eventId: event.id,
        trackId: track.id,
        hasTeam: true,
        skills: "JS,TS",
        reviewedById: org.id,
        reviewedAt: new Date(),
      },
    });
    const team = await prisma.team.create({
      data: {
        eventId: event.id,
        trackId: track.id,
        name: `E2E Team ${i + 1}`,
        status: "approved",
        leaderId: student.id,
        members: {
          create: {
            userId: student.id,
            role: "leader",
            status: "accepted",
          },
        },
        teamRounds: {
          create: { roundId: round1.id, status: "competing" },
        },
      },
    });
    teams.push(team);
  }
  log(
    "teams",
    teams.map((t) => `${t.name}@track${t.trackId}`).join(", "),
  );

  // 4) Assign mentor+judge dual role + pure judge
  await prisma.mentorAssignment.create({
    data: {
      mentorId: mentorJudge.id,
      teamId: teams[0].id,
      assignedById: org.id,
    },
  });
  for (const round of [round1, round2]) {
    const trackScoped = round.isTrackSpecific;
    for (const track of tracks) {
      await prisma.judgeAssignment.create({
        data: {
          judgeId: mentorJudge.id,
          roundId: round.id,
          trackId: trackScoped ? track.id : null,
          assignedById: org.id,
        },
      });
      if (!trackScoped) break;
    }
    for (const track of tracks) {
      await prisma.judgeAssignment.create({
        data: {
          judgeId: judgeOnly.id,
          roundId: round.id,
          trackId: trackScoped ? track.id : null,
          assignedById: org.id,
        },
      });
      if (!trackScoped) break;
    }
  }
  log("assignments: mentorJudge mentors Team1 + judges all; judgeOnly judges all");

  // 5) Open R1 via HTTP (organizer)
  const orgAuth = await api("POST", "/auth/signin", {
    body: { email: "e2e.org@test.com", password: PASS },
  });
  const orgToken = orgAuth.accessToken || orgAuth.token;
  if (!orgToken) fail("no org token", orgAuth);

  await api("PATCH", `/organizer/events/${event.id}/rounds/${round1.id}/status`, {
    token: orgToken,
    body: { status: "open" },
  });
  log("R1 opened");

  // 6) Submissions R1
  const r1Criteria = await prisma.criterion.findMany({
    where: { roundId: round1.id, trackId: null },
    orderBy: { id: "asc" },
  });
  if (r1Criteria.length !== 3) fail("expected 3 R1 criteria", r1Criteria.length);

  const r1Subs = [];
  for (const team of teams) {
    const sub = await prisma.submission.create({
      data: {
        team: { connect: { id: team.id } },
        round: { connect: { id: round1.id } },
        submittedBy: { connect: { id: team.leaderId } },
        status: "submitted",
        fileUrl: `https://example.com/sub-${team.id}-r1.pdf`,
        description: `Demo submission for ${team.name}`,
        submittedAt: new Date(Date.now() - team.id * 1000),
      },
    });
    r1Subs.push(sub);
  }
  log("R1 submissions", r1Subs.length);

  // Close R1 so scoring is allowed
  await api("PATCH", `/organizer/events/${event.id}/rounds/${round1.id}/status`, {
    token: orgToken,
    body: { status: "closed" },
  });
  log("R1 closed");

  // 7) Score via HTTP — conflict + normal
  const mjAuth = await api("POST", "/auth/signin", {
    body: { email: "e2e.mentorjudge@test.com", password: PASS },
  });
  const mjToken = mjAuth.accessToken || mjAuth.token;
  const jAuth = await api("POST", "/auth/signin", {
    body: { email: "e2e.judge@test.com", password: PASS },
  });
  const jToken = jAuth.accessToken || jAuth.token;

  const mentoredSub = r1Subs.find((s) => s.teamId === teams[0].id);
  let conflictOk = false;
  try {
    await api("PUT", `/judge/submissions/${mentoredSub.id}/scores`, {
      token: mjToken,
      body: {
        scores: r1Criteria.map((c) => ({
          criterionId: c.id,
          scoreValue: 8,
          comment: "should fail",
        })),
      },
    });
  } catch (e) {
    if (e.status === 403 && /mentor/i.test(String(e.message))) {
      conflictOk = true;
      log("OK mentor-judge conflict blocked");
    } else {
      fail("unexpected conflict error", e.message);
    }
  }
  if (!conflictOk) fail("expected 403 when mentor scores own team");

  // mentorJudge scores other teams; judgeOnly scores all
  const scorePayload = (base) =>
    r1Criteria.map((c, idx) => ({
      criterionId: c.id,
      scoreValue: Math.min(10, Math.max(1, base + idx)),
      comment: "e2e score",
    }));

  for (const sub of r1Subs) {
    if (sub.teamId === teams[0].id) continue;
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: mjToken,
      body: { scores: scorePayload(6) },
    });
  }
  for (let i = 0; i < r1Subs.length; i++) {
    await api("PUT", `/judge/submissions/${r1Subs[i].id}/scores`, {
      token: jToken,
      body: { scores: scorePayload(9 - i) },
    });
  }
  log("R1 scoring done");

  // 8) List mentoredByMe flag
  const list = await api("GET", `/judge/rounds/${round1.id}/submissions`, {
    token: mjToken,
  });
  const flagged = (list || []).filter((s) => s.mentoredByMe);
  if (flagged.length !== 1) fail("expected 1 mentoredByMe in list", flagged);
  log("OK mentoredByMe flag on list");

  // 9) Publish R1 with advanceCount=1 per track
  const pub1 = await api(
    "POST",
    `/organizer/events/${event.id}/rounds/${round1.id}/publish-results`,
    { token: orgToken, body: { advanceCount: 1 } },
  );
  const advanced = pub1.advancingTeamIds || [];
  if (advanced.length < 1) fail("expected some advanced teams", pub1);
  log("R1 published, advanced:", advanced);

  const r1Status = await prisma.round.findUnique({ where: { id: round1.id } });
  if (r1Status.status !== "results_published") fail("R1 not published");

  // 10) Open R2 + submissions for advanced teams
  await api("PATCH", `/organizer/events/${event.id}/rounds/${round2.id}/status`, {
    token: orgToken,
    body: { status: "open" },
  });

  const r2TeamRounds = await prisma.teamRound.findMany({
    where: { roundId: round2.id, status: "competing" },
  });
  if (r2TeamRounds.length === 0) fail("no teams competing in R2 after publish");

  const r2Criteria = await prisma.criterion.findMany({
    where: { roundId: round2.id, trackId: null },
    orderBy: { id: "asc" },
  });

  const r2Subs = [];
  for (const tr of r2TeamRounds) {
    const team = teams.find((t) => t.id === tr.teamId);
    r2Subs.push(
      await prisma.submission.create({
        data: {
          team: { connect: { id: tr.teamId } },
          round: { connect: { id: round2.id } },
          submittedBy: { connect: { id: team.leaderId } },
          status: "submitted",
          fileUrl: `https://example.com/sub-${tr.teamId}-r2.pdf`,
          description: "Finals demo",
          submittedAt: new Date(),
        },
      }),
    );
  }

  await api("PATCH", `/organizer/events/${event.id}/rounds/${round2.id}/status`, {
    token: orgToken,
    body: { status: "closed" },
  });

  for (let i = 0; i < r2Subs.length; i++) {
    const sub = r2Subs[i];
    const teamId = sub.teamId;
    // dual mentor-judge cannot score mentored team if advanced
    const canMj = teamId !== teams[0].id;
    if (canMj) {
      await api("PUT", `/judge/submissions/${sub.id}/scores`, {
        token: mjToken,
        body: {
          scores: r2Criteria.map((c) => ({
            criterionId: c.id,
            scoreValue: 7 + i,
            comment: "r2",
          })),
        },
      });
    }
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: jToken,
      body: {
        scores: r2Criteria.map((c, idx) => ({
          criterionId: c.id,
          scoreValue: Math.min(10, 8 - i + idx),
          comment: "r2",
        })),
      },
    });
  }
  log("R2 scoring done");

  // 11) Publish final — auto prizes (shared round)
  const pub2 = await api(
    "POST",
    `/organizer/events/${event.id}/rounds/${round2.id}/publish-results`,
    { token: orgToken, body: {} },
  );
  log("R2 published awards:", pub2.awards);

  const awarded = await prisma.team.findMany({
    where: { eventId: event.id, awardId: { not: null } },
    include: { award: true },
    orderBy: { id: "asc" },
  });
  if (awarded.length === 0) fail("expected auto-assigned prizes");
  log(
    "prizes:",
    awarded.map((t) => `${t.name}→${t.award.name}`).join(", "),
  );

  log("\n=== SUCCESS ===");
  log(
    JSON.stringify(
      {
        eventId: event.id,
        round1Id: round1.id,
        round2Id: round2.id,
        advancedTeamIds: advanced,
        awards: awarded.map((t) => ({
          team: t.name,
          prize: t.award.name,
        })),
        accounts: {
          organizer: "e2e.org@test.com / [E2E_DEFAULT_PASSWORD]",
          mentorJudge: "e2e.mentorjudge@test.com / [E2E_DEFAULT_PASSWORD]",
          judge: "e2e.judge@test.com / [E2E_DEFAULT_PASSWORD]",
          students: "e2e.student1..6@test.com / [E2E_DEFAULT_PASSWORD]",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .then(async () => {
    await prisma.$disconnect();
  });
