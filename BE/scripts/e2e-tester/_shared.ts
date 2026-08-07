import { PrismaClient, RoundStatus, TeamStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** Keep e2e scripts at 1 connection — DO Postgres slots are tiny and Nest already holds a pool. */
function e2eDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  try {
    const u = new URL(base);
    u.searchParams.set("connection_limit", "1");
    u.searchParams.set("pool_timeout", "30");
    return u.toString();
  } catch {
    return base;
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: { url: e2eDatabaseUrl() },
  },
});
export const API = process.env.API_BASE || "http://localhost:3000/api";
export const PASS = process.env.E2E_DEFAULT_PASSWORD || "12345678";
export const STUDENT_PASS = process.env.E2E_DEFAULT_PASSWORD || "12345678";
export const ADMIN_PASS = process.env.DEMO_ADMIN_PASSWORD || "12345678";
export const DUMMY_PDF =
  "https://hackathon-submissions.sgp1.digitaloceanspaces.com/general/e2e-demo-problem.pdf";

export const E2E = {
  org: "e2e.org@test.com",
  mentorJudge: "e2e.mentorjudge@test.com",
  judge: "e2e.judge@test.com",
  admin: "admin@gmail.com",
  students: Array.from({ length: 9 }, (_, i) => `e2e.student${i + 1}@test.com`),
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

const COMMENT_TEMPLATES = [
  (name: string, score: number) =>
    `Tiêu chí "${name}": Hoàn thành xuất sắc với ${score}/10 điểm. Kiến trúc và giải pháp kỹ thuật rất rõ ràng, tính thực tiễn cao.`,
  (name: string, score: number) =>
    `Tiêu chí "${name}": Đạt ${score}/10 điểm. Ý tưởng sáng tạo, các chức năng hoàn thiện tốt và giao diện mượt mà.`,
  (name: string, score: number) =>
    `Tiêu chí "${name}": Đánh giá ${score}/10 điểm. Đội thể hiện kỹ năng ấn tượng, đáp ứng trọn vẹn yêu cầu bài toán đề ra.`,
  (name: string, score: number) =>
    `Tiêu chí "${name}": Đạt ${score}/10 điểm. Phần trình bày và tài liệu kỹ thuật chỉn chu, mã nguồn sạch sẽ.`,
  (name: string, score: number) =>
    `Tiêu chí "${name}": Đánh giá ${score}/10 điểm. Sản phẩm thực tế hóa tốt, có tiềm năng phát triển lớn.`,
];

function generateCriterionComment(criterionName: string, scoreValue: number): string {
  const fn = COMMENT_TEMPLATES[Math.floor(Math.random() * COMMENT_TEMPLATES.length)];
  return fn(criterionName, scoreValue);
}

function getRandomScoreFrom4To10WithStep025(): number {
  const steps = Math.floor(Math.random() * 25);
  return 4 + steps * 0.25;
}

export async function signIn(email: string, password = PASS): Promise<string> {
  const passwordsToTry = Array.from(
    new Set([password, PASS, "12345678", "Admin@123", "Student@123"]),
  );

  let lastError: unknown;
  for (const pwd of passwordsToTry) {
    try {
      const auth = await api<{ accessToken?: string; token?: string }>(
        "POST",
        "/auth/signin",
        { body: { email, password: pwd } },
      );
      const token = auth.accessToken || auth.token;
      if (token) return token;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Could not sign in as ${email}`);
}

async function upsertUser(opts: {
  email: string;
  name: string;
  role: string;
  password?: string;
}) {
  const passwordHash = await bcrypt.hash(opts.password ?? PASS, 10);

  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      isActive: true,
      role: opts.role as never,
      name: opts.name,
      passwordHash,
    },
    create: {
      email: opts.email,
      name: opts.name,
      passwordHash,
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
      problemPoolItems: { orderBy: { id: "asc" } },
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
  "Binary Beasts",
  "Stack Smashers",
  "Dev Dominators",
];

const RUBRIC_DEFS = [
  { name: "Technical", weight: 40, description: "Implementation quality" },
  { name: "Impact", weight: 30, description: "Problem fit & impact" },
  { name: "Presentation", weight: 30, description: "Demo & clarity" },
];

const DEMO_TRACKS = [
  { name: "Bảng AI & Data", description: "Machine Learning, Data Science" },
  { name: "Bảng Web3", description: "Blockchain, DeFi, Smart Contracts" },
  { name: "Bảng Green Tech", description: "Sustainability, IoT, Energy" },
];

const DEMO_CONTACTS = [
  {
    label: "Organizer Support",
    name: "SEAL Organizing Committee",
    email: "seal@fe.edu.vn",
    phone: "0123 456 789",
    detail:
      "Questions about registration, teams, schedules, and event logistics.",
    responseTime: "Within 24 hours",
  },
  {
    label: "Technical Support",
    name: "SEAL Technical Team",
    email: "tech.seal@fe.edu.vn",
    phone: "0987 654 321",
    detail:
      "Support for GitHub, submissions, file upload, and workspace access.",
    responseTime: "During competition hours",
  },
];

const DEMO_RULE_GROUPS = [
  {
    title: "Team Rules",
    rules: [
      "Each team must follow the official team size configured for the event.",
      "Participants must use their registered account and team workspace.",
      "Team members are responsible for keeping project work original and transparent.",
    ],
  },
  {
    title: "Submission Rules",
    rules: [
      "Submit before the round deadline shown in the event workspace.",
      "GitHub repositories or uploaded files must be accessible to organizers and judges.",
      "Late, inaccessible, or incomplete submissions may not be evaluated.",
    ],
  },
  {
    title: "Judging Rules",
    rules: [
      "Projects are evaluated using the official rubric for each round.",
      "Judge decisions are based on submitted work, presentation, and rule compliance.",
      "Organizers may request clarification when submission evidence is unclear.",
    ],
  },
];

const DEMO_FAQ = [
  {
    question: "Who can join this event?",
    answer:
      "Students who meet the event eligibility rules can register as part of a team.",
  },
  {
    question: "Can a team update its submission?",
    answer:
      "Teams can update submissions while the round is still open. After the deadline, submissions are locked for evaluation.",
  },
  {
    question: "Where will announcements be posted?",
    answer:
      "Official announcements are posted in the event workspace and registered contact channels.",
  },
];

function demoSeason(date: Date): "Spring" | "Summer" | "Fall" {
  const month = date.getMonth() + 1;
  if (month <= 4) return "Spring";
  if (month <= 8) return "Summer";
  return "Fall";
}

function demoSchedule(now = Date.now()) {
  const at = (daysFromNow: number, hours: number, minutes = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };
  return {
    registrationDeadline: at(7, 23, 59),
    startDate: at(8, 8),
    endDate: at(10, 17),
    round1Deadline: at(9, 23, 59),
    round2Deadline: at(10, 16),
  };
}

/** Payload giống form organizer — pass CreateEventDto validation. */
export function buildFlowBDemoEventPayload(now = Date.now()) {
  const schedule = demoSchedule(now);
  const tag = new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return {
    name: `SEAL Demo ${tag}`,
    description:
      "Flow B demo: pool đề + ceremony 2 phase, 3 bảng, top 2/vòng 1 → 6 finalist, 4 giải chung kết.",
    season: demoSeason(new Date(now)),
    year: new Date(now).getFullYear(),
    status: "active" as const,
    deferredTrackAssignment: true,
    studentSelfTrackDraw: false,
    maxTeams: 12,
    minMembersPerTeam: 1,
    maxMembersPerTeam: 4,
    registrationDeadline: schedule.registrationDeadline,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    githubOrgUrl: "https://github.com/DEMO-SEAL-Hackathon",
    location: JSON.stringify({
      venueName: "FPT University HCM",
      room: "Innovation Hall",
      address: "Lô E2a-7, Khu Công nghệ cao, TP. Thủ Đức",
      meetingPlatform: "Google Meet",
      meetingUrl: "https://meet.google.com/",
      note: "Teams receive room allocation before event day.",
    }),
    contact: JSON.stringify(DEMO_CONTACTS),
    rules: JSON.stringify(DEMO_RULE_GROUPS),
    faq: DEMO_FAQ,
    prizes: [
      {
        name: "Giải Nhất",
        description: "Champion — Gold Trophy + AWS Credits",
        quantity: 1,
        amount: 10_000_000,
        placement: 1 as const,
        currency: "VND",
      },
      {
        name: "Giải Nhì",
        description: "Runner-up — Silver Trophy + AWS Credits",
        quantity: 1,
        amount: 5_000_000,
        placement: 2 as const,
        currency: "VND",
      },
      {
        name: "Giải Ba",
        description: "Third place — Bronze + Swag",
        quantity: 1,
        amount: 2_500_000,
        placement: 3 as const,
        currency: "VND",
      },
      {
        name: "Giải Khuyến khích",
        description: "Honorable mention — Swag + Credits",
        quantity: 1,
        amount: 1_000_000,
        placement: null,
        currency: "VND",
      },
    ],
    tracks: [],
    rounds: [
      {
        roundNumber: 1,
        name: "Vòng Sơ loại (Round 1)",
        submissionType: "file" as const,
        submissionDeadline: schedule.round1Deadline,
        maxFileSizeMb: 50,
        isTrackSpecific: true,
        advanceCount: 2,
      },
      {
        roundNumber: 2,
        name: "Vòng Chung kết (Round 2)",
        submissionType: "github_link" as const,
        submissionDeadline: schedule.round2Deadline,
        maxFileSizeMb: 20,
        isTrackSpecific: true,
        advanceCount: null,
      },
    ],
  };
}

async function setupFlowBDemoTracksAndPool(
  eventId: number,
  token: string,
  round1Id: number,
  round2Id: number,
) {
  const trackIds: number[] = [];
  for (const track of DEMO_TRACKS) {
    const created = await api<{ id: number; name: string }>(
      "POST",
      `/organizer/events/${eventId}/rounds/${round1Id}/tracks`,
      { token, body: track },
    );
    trackIds.push(created.id);
    log(`  Track R1: ${created.name}`);
  }

  for (const trackId of trackIds) {
    await api("PATCH", `/organizer/events/${eventId}/rounds/${round2Id}/problem-file`, {
      token,
      body: { problemFileUrl: null, trackId },
    });
  }
  log(`  Synced ${trackIds.length} bảng → R2`);

  for (let i = 0; i < DEMO_TRACKS.length; i++) {
    await api("POST", `/organizer/events/${eventId}/problem-pool`, {
      token,
      body: {
        label: `Đề mẫu ${i + 1}`,
        problemFileUrl: DUMMY_PDF,
      },
    });
  }
  log(`  Pool: ${DEMO_TRACKS.length} đề chưa gán`);
}

async function seedDemoRubricsForEvent(eventId: number, authorId: number) {
  const event = await loadEvent(eventId);
  for (const round of event.rounds) {
    for (const rubric of RUBRIC_DEFS) {
      const existing = await prisma.criterion.findFirst({
        where: { roundId: round.id, trackId: null, name: rubric.name },
      });
      if (existing) continue;
      await prisma.criterion.create({
        data: {
          name: rubric.name,
          description: rubric.description,
          maxScore: 10,
          weight: rubric.weight,
          roundId: round.id,
          trackId: null,
          createdById: authorId,
        },
      });
    }
    log(`  Rubrics: ${round.name} (40/30/30)`);
  }
}

async function assertFlowBDemoEventReady(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tracks: true,
      rounds: { include: { trackProblems: true }, orderBy: { roundNumber: "asc" } },
      prizes: true,
      problemPoolItems: true,
    },
  });
  if (!event) fail(`Event ${eventId} missing after create`);

  if (!event.deferredTrackAssignment) fail("Event must use Flow B");
  if (event.tracks.length !== DEMO_TRACKS.length) {
    fail(`Expected ${DEMO_TRACKS.length} tracks, got ${event.tracks.length}`);
  }
  if (event.rounds.length !== 2) fail(`Expected 2 rounds, got ${event.rounds.length}`);
  if (event.prizes.length !== 4) fail(`Expected 4 prizes, got ${event.prizes.length}`);

  const ranked = event.prizes
    .filter((p) => p.placement != null)
    .sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0));
  if (ranked.length !== 3) fail("Expected 3 ranked prizes");
  for (let i = 1; i < ranked.length; i++) {
    if ((ranked[i - 1].amount ?? 0) <= (ranked[i].amount ?? 0)) {
      fail("Prize amounts must decrease by placement");
    }
  }

  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  const round2 = event.rounds.find((r) => r.roundNumber === 2);
  if (!round1?.isTrackSpecific || !round2?.isTrackSpecific) {
    fail("Both rounds must be track-specific");
  }
  if (round1.advanceCount !== 2) fail("R1 advanceCount must be 2");
  if (round2.advanceCount != null) fail("Final round must not have advanceCount");

  if (round1.trackProblems.length !== DEMO_TRACKS.length) {
    fail(`R1 needs ${DEMO_TRACKS.length} scoped tracks`);
  }
  if (round2.trackProblems.length !== DEMO_TRACKS.length) {
    fail(`R2 needs ${DEMO_TRACKS.length} synced tracks`);
  }

  if (event.problemPoolItems.length < DEMO_TRACKS.length) {
    fail("Problem pool must have at least 3 items");
  }
  if (event.problemPoolItems.some((p) => p.assignedRoundId != null)) {
    fail("Pool items must be unassigned before Phase 1");
  }

  if (!event.contact?.trim() || !event.rules?.trim() || !event.faq) {
    fail("Event must include contact, rules, and FAQ");
  }

  const rubricCount = await prisma.criterion.count({
    where: { round: { eventId } },
  });
  if (rubricCount < event.rounds.length * RUBRIC_DEFS.length) {
    fail("Each round must have demo rubrics");
  }
}

/** One-click Flow B event — API create (validated) + tracks, pool, rubrics. */
export async function createFlowBDemoEvent(): Promise<number> {
  log("=== [00] Create Flow B SEAL demo event (validated) ===");
  await seedUsers();

  const admin = await prisma.user.findUnique({ where: { email: E2E.admin } });
  if (!admin) fail("Admin user missing after seed");

  const token = await organizerToken();
  const payload = buildFlowBDemoEventPayload();

  const created = await api<{
    id: number;
    name: string;
    rounds: Array<{ id: number; roundNumber: number; name: string }>;
  }>("POST", "/organizer/events", { token, body: payload });

  const round1 = created.rounds.find((r) => r.roundNumber === 1);
  const round2 = created.rounds.find((r) => r.roundNumber === 2);
  if (!round1 || !round2) fail("Created event missing R1/R2");

  log(`OK Event #${created.id}: ${created.name} (via API)`);
  await setupFlowBDemoTracksAndPool(created.id, token, round1.id, round2.id);
  await seedDemoRubricsForEvent(created.id, admin.id);
  await assertFlowBDemoEventReady(created.id);

  log(`  R1: advanceCount=2 · R2: finals · ${DEMO_TRACKS.length} bảng · pool + rubrics`);
  log(`\n👉 TARGET_EVENT_ID=${created.id}`);
  log(`   Mở /organizer/events/${created.id} → L2 (teams) → ceremony → L7+`);
  return created.id;
}

export function runScriptMain(fn: () => Promise<void>) {
  fn()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(disconnect);
}

/** Step 02 — create approved teams (matches student register flow: auto-approved). */
export async function createDemoTeams() {
  const eventId = getTargetEventId();
  log(`=== [02] Create approved teams (event ${eventId}) ===`);
  const event = await loadEvent(eventId);
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Event needs Round 1");

  const students = await Promise.all(
    E2E.students.map((email) => prisma.user.findUnique({ where: { email } })),
  );
  const validStudents = students.filter(Boolean);
  if (!validStudents.length) fail("Run live-01-seed-users first");

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
        status: TeamStatus.approved,
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

    await prisma.teamRound.upsert({
      where: { teamId_roundId: { teamId: team.id, roundId: round1.id } },
      update: { status: "competing" },
      create: { teamId: team.id, roundId: round1.id, status: "competing" },
    });

    log(`Created approved: ${team.name}${track ? ` (${track.name})` : ""}`);
    created++;
  }

  if (!created) log("No new teams — demo students may already be registered");
  else log(`OK ${created} approved team(s) — sẵn sàng ceremony / Phase 2`);
}

/** Step 03 — approve any leftover pending teams (usually no-op after 02). */
export async function approveTeams() {
  const eventId = getTargetEventId();
  log(`=== [03] Approve pending teams (event ${eventId}) ===`);
  const orgToken = await organizerToken();

  const pending = await prisma.team.findMany({
    where: { eventId, status: TeamStatus.pending },
    select: { id: true, name: true },
  });
  if (!pending.length) {
    log("No pending teams — all already approved (giống luồng đăng ký thật)");
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
  const event = await loadEvent(eventId);
  if (!event.deferredTrackAssignment) {
    log("Skip — not deferred track assignment (Flow A)");
    return;
  }
  const round1 = event.rounds.find((r) => r.roundNumber === 1);
  if (!round1) fail("Event needs Round 1 for track ceremony");

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
    body: { roundId: round1.id, studentSelfDraw: false },
  });
  log(`OK revealed tracks for ${untracked} team(s) (roundId=${round1.id})`);
}

/**
 * Assign mentor + judges for a single round (default Round 1).
 * Do NOT assign every round at once — that makes Round 1 stakeholders UI
 * show Round 2 judge rows and confuses the demo.
 */
export async function assignStakeholders(opts?: { roundNumber?: number }) {
  const eventId = getTargetEventId();
  const roundNumber = opts?.roundNumber ?? 1;
  log(
    `=== [05] Assign mentor & judges for Round ${roundNumber} (event ${eventId}) ===`,
  );
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

  const round = event.rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) fail(`Round ${roundNumber} not found on event ${eventId}`);

  const requireTrackScope =
    round.isTrackSpecific || Boolean(event.deferredTrackAssignment);
  let trackIds: number[] | undefined;
  if (requireTrackScope) {
    // Prefer tracks scoped into THIS round, not the whole event catalog.
    const scoped = (round.trackProblems ?? [])
      .map((tp) => tp.trackId)
      .filter((id): id is number => id != null);
    trackIds = scoped.length > 0 ? [...new Set(scoped)] : event.tracks.map((t) => t.id);
    if (!trackIds.length) {
      fail(`Round "${round.name}": add tracks to this round first.`);
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
    log(`OK judge ${judge.email} → ${round.name} only`);
  }
}

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

  const buildRandomScores = () =>
    criteria.map((c) => {
      const scoreValue = getRandomScoreFrom4To10WithStep025();
      return {
        criterionId: c.id,
        scoreValue,
        comment: generateCriterionComment(c.name, scoreValue),
      };
    });

  for (const sub of subs) {
    if (sub.teamId === mentoredTeam.id) continue;
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: mjToken,
      body: { scores: buildRandomScores() },
    });
  }
  for (let i = 0; i < subs.length; i++) {
    await api("PUT", `/judge/submissions/${subs[i].id}/scores`, {
      token: jToken,
      body: { scores: buildRandomScores() },
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
    { token: orgToken, body: {} },
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

  let r2Subs = await prisma.submission.findMany({ where: { roundId: round2.id } });
  if (!r2Subs.length) {
    log("No Round 2 submissions found. Auto-creating Round 2 submissions...");
    await submitRound2();
    r2Subs = await prisma.submission.findMany({ where: { roundId: round2.id } });
  }
  if (!r2Subs.length) {
    fail(
      "No submissions found for Round 2 and could not auto-create any. Ensure Round 1 results are published and Round 2 is opened.",
    );
  }

  const mentoredTeamId = (
    await prisma.team.findFirst({
      where: { eventId, status: TeamStatus.approved },
      orderBy: { id: "asc" },
    })
  )?.id;

  const mjToken = await signIn(E2E.mentorJudge);
  const jToken = await signIn(E2E.judge);

  for (const sub of r2Subs) {
    const buildRandomScores = () =>
      criteria.map((c) => {
        const scoreValue = getRandomScoreFrom4To10WithStep025();
        return {
          criterionId: c.id,
          scoreValue,
          comment: generateCriterionComment(c.name, scoreValue),
        };
      });

    if (sub.teamId !== mentoredTeamId) {
      await api("PUT", `/judge/submissions/${sub.id}/scores`, {
        token: mjToken,
        body: { scores: buildRandomScores() },
      });
    }
    await api("PUT", `/judge/submissions/${sub.id}/scores`, {
      token: jToken,
      body: { scores: buildRandomScores() },
    });
  }
  log(`OK scored ${r2Subs.length} R2 submission(s) with random scores (>=5) and detailed criterion comments`);
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
