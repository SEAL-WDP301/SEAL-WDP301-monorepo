/**
 * Create org repos + push real commit history via local git (more reliable than Git Data API).
 * Token from BE/.env — never printed.
 *
 * Run from BE/: node scripts/push-github-org-demo-activity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
const envRaw = fs.readFileSync(envPath, 'utf8');
const token = (envRaw.match(/^GITHUB_TOKEN=(.+)$/m) || [])[1]
  ?.trim()
  .replace(/^["']|["']$/g, '');
if (!token) throw new Error('GITHUB_TOKEN missing in BE/.env');

const ORG = 'DEMO-SEAL-HackaThon-ORG';
const API = 'https://api.github.com';

const TEAMS = [
  { id: 160, name: 'HuskyWannaSwim', commits: [5, 8, 6] },
  { id: 161, name: 'Code Crushers', commits: [4, 6, 5] },
  { id: 163, name: 'Null Pointers', commits: [3, 5, 4] },
  { id: 164, name: 'Bug Hunters', commits: [2, 4, 3] },
  { id: 165, name: 'Stack Smashers', commits: [3, 5, 4] },
  { id: 167, name: 'Binary Beasts', commits: [2, 4, 3] },
  { id: 168, name: 'Dev Dominators', commits: [4, 5, 4] },
  { id: 162, name: 'Byte Warriors', commits: [0, 0, 0], idle: true },
];

const DAYS = ['2026-07-28', '2026-07-29', '2026-07-30'];

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
  'feat: webhook ingest for activity',
  'style: polish fleet table',
  'perf: cache inventory queries',
  'feat: mobile barcode scan screen',
  'test: orders controller happy path',
  'chore: seed demo warehouses',
  'feat: real-time tracking gateway',
  'fix: race on stock decrement',
  'feat: organizer activity dashboard',
  'chore: bump prisma schema',
  'feat: shipment status timeline',
];

const FILE_POOL = [
  'apps/web/app/page.tsx',
  'apps/web/components/dashboard.tsx',
  'apps/web/components/shipment-map.tsx',
  'apps/web/lib/api.ts',
  'apps/web/styles/globals.css',
  'services/api/src/orders/orders.controller.ts',
  'services/api/src/orders/orders.service.ts',
  'services/api/src/inventory/inventory.service.ts',
  'services/api/src/tracking/tracking.gateway.ts',
  'services/api/prisma/schema.prisma',
  'services/api/src/auth/jwt.strategy.ts',
  'packages/shared/src/types/shipment.ts',
  'packages/shared/src/utils/eta.ts',
  'docker-compose.yml',
  'docs/architecture.md',
  'docs/runbook.md',
];

function slugRepo(teamName, teamId) {
  const slug = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `seal-2026-spring-${slug}-t${teamId}`;
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SEAL-github-demo-seed',
    'Content-Type': 'application/json',
  };
}

async function gh(method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || text || res.statusText;
    const err = new Error(`${method} ${urlPath} → ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fileContent(team, filepath, seq) {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts')) {
    return (
      `// ${team.name} · ${filepath} · rev ${seq}\n` +
      `export function Module${seq}() {\n` +
      `  return { team: '${team.name}', path: '${filepath}', rev: ${seq} };\n` +
      `}\n`
    );
  }
  if (filepath.endsWith('.yml') || filepath.endsWith('.yaml')) {
    return `name: ci-${team.id}\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo "team ${team.name} rev ${seq}"\n`;
  }
  if (filepath.endsWith('.prisma')) {
    return `generator client {\n  provider = "prisma-client-js"\n}\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\nmodel Shipment {\n  id     Int    @id @default(autoincrement())\n  code   String\n  status String\n  rev    Int    @default(${seq})\n}\n`;
  }
  if (filepath.endsWith('.css')) {
    return `:root { --seal-accent: #f37021; --rev: ${seq}; }\n.fleet { color: var(--seal-accent); }\n`;
  }
  if (filepath.endsWith('.md')) {
    return `# ${team.name}\n\nSupply Chain SEAL 2026 · revision ${seq}\n`;
  }
  return `version: ${seq}\nservice: supply-chain\nteam: ${team.name}\n`;
}

async function ensureRepo(repoName, description) {
  try {
    return await gh('GET', `/repos/${ORG}/${repoName}`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  console.log(`  create repo ${repoName}`);
  return gh('POST', `/orgs/${ORG}/repos`, {
    name: repoName,
    description,
    private: false,
    auto_init: true,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function git(cwd, args, envExtra = {}) {
  execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...envExtra },
  });
}

function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

async function fillRepo(team, me) {
  const repoName = slugRepo(team.name, team.id);
  console.log(`\n== ${team.name} → ${repoName}`);
  await ensureRepo(repoName, `${team.name} — Supply Chain SEAL 2026 (demo)`);
  await sleep(1200);

  if (team.idle) {
    console.log('  idle — only initial README on GitHub');
    return;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), `seal-${team.id}-`));
  const remote = `https://x-access-token:${token}@github.com/${ORG}/${repoName}.git`;

  try {
    git(work, ['clone', '--depth', '1', remote, 'repo']);
    const repoDir = path.join(work, 'repo');
    git(repoDir, ['config', 'user.name', me.login]);
    git(repoDir, ['config', 'user.email', `${me.login}@users.noreply.github.com`]);

    let seq = 0;
    for (let d = 0; d < DAYS.length; d++) {
      const n = team.commits[d] || 0;
      for (let i = 0; i < n; i++) {
        seq += 1;
        const hour = 3 + ((seq * 3 + d) % 18);
        const minute = (seq * 7) % 60;
        const dateIso = `${DAYS[d]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+0000`;
        const fileCount = 2 + (seq % 3);
        for (let f = 0; f < fileCount; f++) {
          const filepath = FILE_POOL[(team.id + seq + f * 5) % FILE_POOL.length];
          writeFile(repoDir, filepath, fileContent(team, filepath, seq));
        }
        writeFile(
          repoDir,
          'README.md',
          `# ${team.name}\n\nSupply Chain SEAL 2026 demo repo.\n\n- Team id: ${team.id}\n- Commit rev: ${seq}\n- Day: ${DAYS[d]}\n`,
        );

        git(repoDir, ['add', '-A']);
        const message = MESSAGES[(team.id + seq) % MESSAGES.length];
        git(repoDir, ['commit', '-m', message], {
          GIT_AUTHOR_DATE: dateIso,
          GIT_COMMITTER_DATE: dateIso,
        });
        process.stdout.write(`  ✓ ${seq} ${message.slice(0, 52)}\n`);
      }
    }

    git(repoDir, ['push', 'origin', 'HEAD']);
    console.log(`  pushed ${seq} commits`);
  } finally {
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const me = await gh('GET', '/user');
  console.log(`Authenticated as ${me.login}`);
  console.log(`Target org: ${ORG}`);

  for (const team of TEAMS) {
    await fillRepo(team, me);
  }

  console.log('\nDone. Open GitHub org repos, then Sync trên dashboard để kéo về DB.');
}

main().catch((e) => {
  console.error(e.stderr?.toString?.() || e.message || e);
  process.exit(1);
});
