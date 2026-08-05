/**
 * Benchmark key organizer / ceremony / scoring flows.
 * Run: node -r ts-node/register -r tsconfig-paths/register scripts/benchmark-flows.ts [eventId]
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ProblemPoolService } from "../src/modules/event/services/problem-pool.service";
import { RoundRankingService } from "../src/modules/event/services/round-ranking.service";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const eventId = parseInt(process.argv[2] || "66", 10);
const API = process.env.API_BASE_URL || "http://localhost:3000/api";

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - t0);
  const bucket =
    ms < 300 ? "fast" : ms < 1000 ? "ok" : ms < 3000 ? "slow" : "very slow";
  console.log(`  ${label.padEnd(42)} ${String(ms).padStart(5)} ms  [${bucket}]`);
  return result;
}

async function httpGet(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function httpPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function main() {
  console.log(`\nFlow benchmark — event #${eventId}\n`);
  console.log("=== Database / service layer ===");

  const prisma = new PrismaClient();
  const poolService = new ProblemPoolService(prisma as never);
  const rankingService = new RoundRankingService(
    prisma as never,
    { emit: () => undefined } as unknown as EventEmitter2,
    { syncRepositoriesForRound: async () => undefined } as never,
    { sendRoundResultEmail: async () => undefined } as never,
  );

  await time("DB ping (SELECT 1)", () => prisma.$queryRaw`SELECT 1`);

  const event = await time("Load event (tracks+rounds+pool+prizes)", () =>
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        tracks: { include: { _count: { select: { teams: true } } } },
        rounds: {
          include: {
            _count: { select: { submissions: true } },
            trackProblems: true,
          },
        },
        prizes: true,
        problemPoolItems: { orderBy: { id: "asc" } },
        _count: { select: { teams: true } },
      },
    }),
  );

  if (!event) {
    console.error(`Event #${eventId} not found`);
    process.exit(1);
  }

  const roundId =
    event.rounds.find((r) => r.status === "closed")?.id ?? event.rounds[0]?.id;

  await time("Problem pool list", () => poolService.listPoolItems(eventId));

  if (roundId) {
    await time("Round rankings preview", () =>
      rankingService.getRoundRankings(eventId, roundId),
    );
    await time("Detailed rankings (heavy UI query)", () =>
      rankingService.getDetailedRoundRankings(eventId, roundId),
    );
  }

  await time("Teams list (approved, limit 500)", () =>
    prisma.team.findMany({
      where: { eventId, status: "approved" },
      take: 500,
      include: {
        track: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    }),
  );

  await time("Submissions + scores", () =>
    prisma.submission.findMany({
      where: { round: { eventId } },
      take: 200,
      include: { team: true, scores: true },
    }),
  );

  console.log("\n=== HTTP API (organizer) ===");

  let token: string | null = null;
  try {
    const login = await time("POST /auth/login", () =>
      httpPost(`${API}/auth/login`, {
        email: "admin@gmail.com",
        password: "12345678",
      }),
    );
    token =
      (login as { data?: { accessToken?: string } })?.data?.accessToken ??
      (login as { accessToken?: string })?.accessToken ??
      null;
  } catch (e) {
    console.log(`  Login skipped: ${(e as Error).message}`);
  }

  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    await time("GET /organizer/events/:id", () =>
      httpGet(`${API}/organizer/events/${eventId}`, headers),
    );
    if (roundId) {
      await time("GET rankings/detailed", () =>
        httpGet(
          `${API}/organizer/events/${eventId}/rounds/${roundId}/rankings/detailed`,
          headers,
        ),
      );
    }
    await time("GET teams (limit 500)", () =>
      httpGet(
        `${API}/organizer/teams/events/${eventId}?limit=500&status=approved`,
        headers,
      ),
    );
    await time("GET problem pool", () =>
      httpGet(`${API}/organizer/events/${eventId}/problem-pool`, headers),
    );
  }

  console.log("\n=== FE first paint (HTML) ===");
  const feRoutes = [
    `/organizer/events/${eventId}/tracks`,
    `/organizer/events/${eventId}/overview`,
    roundId
      ? `/organizer/events/${eventId}/rounds/${roundId}/rankings`
      : null,
  ].filter(Boolean) as string[];

  for (const route of feRoutes) {
    try {
      await time(`FE ${route}`, () =>
        httpGet(`http://localhost:3001${route}`),
      );
    } catch (e) {
      console.log(`  FE ${route} → ${(e as Error).message}`);
    }
  }

  console.log("\n=== Why it feels slow (typical) ===");
  console.log("  • DB remote (DigitalOcean SG): +200–800ms mỗi query");
  console.log("  • Layout load 3 API: event + teams + profile cùng lúc");
  console.log("  • Rankings page: detailed rankings = nhiều join/score");
  console.log("  • Team lottery preview: GET teams?limit=500");
  console.log("  • Publish results: transaction nhiều team (đã tăng timeout 30s)");
  console.log("\n  fast <300ms | ok <1s | slow <3s | very slow >=3s\n");

  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
