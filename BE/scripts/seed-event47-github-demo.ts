/**
 * Seed rich demo GitHub commits for Supply Chain SEAL 2026 (event 47).
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-event47-github-demo.ts
 * Or: node with compiled / prisma via tsx if available.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EVENT_ID = 47;
const ORG = 'DEMO-SEAL-HackaThon-ORG';

type FileRow = {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
};

const AUTHORS: Record<number, string[]> = {
  160: ['husky-lead', 'swim-dev', 'seal-fe'],
  161: ['crush-alpha', 'crush-beta', 'crush-ops'],
  162: ['byte-w1', 'byte-w2'],
  163: ['null-ptr', 'void-main', 'segfault'],
  164: ['bug-hunter', 'qa-seal'],
  165: ['stack-sm', 'heap-dev'],
  166: ['syntax-lead'],
  167: ['binary-b', 'beast-fe', 'beast-be'],
  168: ['dev-dom', 'dom-api', 'dom-ui'],
};

const FILE_POOL: Array<{ path: string; kind: 'fe' | 'be' | 'ops' }> = [
  { path: 'apps/web/app/page.tsx', kind: 'fe' },
  { path: 'apps/web/components/dashboard.tsx', kind: 'fe' },
  { path: 'apps/web/components/shipment-map.tsx', kind: 'fe' },
  { path: 'apps/web/lib/api.ts', kind: 'fe' },
  { path: 'apps/web/styles/globals.css', kind: 'fe' },
  { path: 'services/api/src/orders/orders.controller.ts', kind: 'be' },
  { path: 'services/api/src/orders/orders.service.ts', kind: 'be' },
  { path: 'services/api/src/inventory/inventory.service.ts', kind: 'be' },
  { path: 'services/api/src/tracking/tracking.gateway.ts', kind: 'be' },
  { path: 'services/api/prisma/schema.prisma', kind: 'be' },
  { path: 'services/api/src/auth/jwt.strategy.ts', kind: 'be' },
  { path: 'packages/shared/src/types/shipment.ts', kind: 'be' },
  { path: 'packages/shared/src/utils/eta.ts', kind: 'be' },
  { path: 'docker-compose.yml', kind: 'ops' },
  { path: 'README.md', kind: 'ops' },
  { path: '.github/workflows/ci.yml', kind: 'ops' },
  { path: 'docs/architecture.md', kind: 'ops' },
  { path: 'apps/web/public/hero-supply.jpg', kind: 'fe' },
  { path: 'services/api/src/webhooks/github.controller.ts', kind: 'be' },
  { path: 'apps/mobile/screens/ScanScreen.tsx', kind: 'fe' },
];

const MESSAGES = [
  'feat: scaffold supply-chain dashboard',
  'feat: add shipment tracking map',
  'fix: correct ETA timezone for VN lanes',
  'feat: inventory low-stock alerts',
  'chore: wire CI for monorepo',
  'refactor: split orders service',
  'feat: JWT auth for team APIs',
  'docs: architecture overview',
  'fix: null-safe tracking payload',
  'feat: webhook ingest for GitHub activity',
  'style: polish fleet table',
  'perf: cache inventory queries',
  'feat: mobile barcode scan screen',
  'test: orders controller happy path',
  'chore: seed demo warehouses',
  'feat: real-time tracking gateway',
  'fix: race condition on stock decrement',
  'feat: organizer activity dashboard',
  'chore: bump prisma schema',
  'feat: shipment status timeline',
];

function slugRepo(teamName: string, teamId: number) {
  const slug = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `seal-2026-spring-${slug}-t${teamId}`;
}

function pickFiles(seed: number, count: number): FileRow[] {
  const out: FileRow[] = [];
  for (let i = 0; i < count; i++) {
    const file = FILE_POOL[(seed + i * 3) % FILE_POOL.length];
    const statusRoll = (seed + i) % 10;
    const status: FileRow['status'] =
      statusRoll === 0
        ? 'removed'
        : statusRoll <= 2
          ? 'added'
          : statusRoll === 3
            ? 'renamed'
            : 'modified';
    const additions =
      status === 'removed' ? 0 : 8 + ((seed + i * 7) % 120);
    const deletions =
      status === 'added' ? 0 : 2 + ((seed + i * 5) % 40);
    out.push({
      filename: file.path,
      status,
      additions,
      deletions,
    });
  }
  return out;
}

function hoursOnDay(dayIso: string, hour: number, minute: number) {
  return new Date(`${dayIso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
}

async function main() {
  const event = await prisma.event.findUnique({ where: { id: EVENT_ID } });
  if (!event) throw new Error(`Event ${EVENT_ID} not found`);

  const teams = await prisma.team.findMany({
    where: { eventId: EVENT_ID },
    orderBy: { id: 'asc' },
  });

  console.log(`Seeding GitHub demo for "${event.name}" · ${teams.length} teams`);

  // Assign demo repos to teams missing them (except leave Syntax Squad without repo)
  for (const team of teams) {
    if (team.id === 166) continue; // no repo → Uncommitted / no GitHub
    if (!team.githubRepoUrl || !team.githubRepoName) {
      const name = slugRepo(team.name, team.id);
      await prisma.team.update({
        where: { id: team.id },
        data: {
          githubRepoName: name,
          githubRepoUrl: `https://github.com/${ORG}/${name}`,
        },
      });
      console.log(`  + repo → ${team.name}: ${name}`);
    }
  }

  // Wipe existing commits for this event (demo replace)
  const deleted = await prisma.githubCommit.deleteMany({
    where: { team: { eventId: EVENT_ID } },
  });
  console.log(`  cleared ${deleted.count} old commits`);

  // Activity plan: commits per team across Jul 28–30 (leave Byte Warriors idle)
  const plan: Record<number, number[]> = {
    // [day0, day1, day2] counts
    160: [6, 9, 7], // Husky — busiest
    161: [4, 7, 6], // Code Crushers
    162: [0, 0, 0], // Byte Warriors — Idle (repo but uncommitted)
    163: [3, 5, 5], // Null Pointers
    164: [2, 4, 3], // Bug Hunters
    165: [3, 5, 4], // Stack Smashers
    166: [0, 0, 0], // Syntax Squad — no repo
    167: [2, 4, 4], // Binary Beasts
    168: [4, 6, 5], // Dev Dominators
  };

  const days = ['2026-07-28', '2026-07-29', '2026-07-30'];
  let total = 0;

  for (const team of teams) {
    const counts = plan[team.id] || [2, 3, 2];
    const authors = AUTHORS[team.id] || ['demo-dev'];
    const repoName =
      team.githubRepoName || slugRepo(team.name, team.id);
    let seq = 0;

    for (let d = 0; d < days.length; d++) {
      const n = counts[d] || 0;
      for (let i = 0; i < n; i++) {
        seq += 1;
        const hour = 2 + ((seq * 3 + d * 2) % 20);
        const minute = (seq * 11) % 60;
        const author = authors[seq % authors.length];
        const files = pickFiles(team.id * 17 + seq * 13, 2 + (seq % 4));
        const additions = files.reduce((s, f) => s + f.additions, 0);
        const deletions = files.reduce((s, f) => s + f.deletions, 0);
        const hash = `demo${team.id.toString(16)}${d}${seq}`
          .padEnd(40, '0')
          .slice(0, 40);
        const msg = MESSAGES[(team.id + seq) % MESSAGES.length];

        await prisma.githubCommit.create({
          data: {
            teamId: team.id,
            commitHash: hash,
            message: msg,
            pusher: author,
            authorLogin: author,
            authorName: author.replace(/-/g, ' '),
            url: `https://github.com/${ORG}/${repoName}/commit/${hash}`,
            timestamp: hoursOnDay(days[d], hour, minute),
            additions,
            deletions,
            changedFiles: files.length,
            files,
          },
        });
        total += 1;
      }
    }
    console.log(
      `  ${team.name}: ${counts.reduce((a, b) => a + b, 0)} commits`,
    );
  }

  console.log(`Done. Inserted ${total} demo commits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
