/**
 * Pull real commits from GitHub into DB for event 47 (replaces demo* seed rows).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envRaw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const token = (envRaw.match(/^GITHUB_TOKEN=(.+)$/m) || [])[1]
  ?.trim()
  .replace(/^["']|["']$/g, '');
if (!token) throw new Error('GITHUB_TOKEN missing');

const ORG = 'DEMO-SEAL-HackaThon-ORG';
const EVENT_ID = 47;
const prisma = new PrismaClient();

async function gh(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SEAL-sync',
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function getCommitDetail(repo, sha) {
  try {
    const d = await gh(
      `https://api.github.com/repos/${ORG}/${repo}/commits/${sha}`,
    );
    return {
      additions: d.stats?.additions ?? null,
      deletions: d.stats?.deletions ?? null,
      changedFiles: d.files?.length ?? null,
      files: (d.files || []).slice(0, 40).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
      authorLogin: d.author?.login || d.commit?.author?.name || null,
      authorName: d.commit?.author?.name || null,
    };
  } catch {
    return {
      additions: null,
      deletions: null,
      changedFiles: null,
      files: null,
      authorLogin: null,
      authorName: null,
    };
  }
}

async function main() {
  const cleared = await prisma.githubCommit.deleteMany({
    where: { team: { eventId: EVENT_ID } },
  });
  console.log(`cleared ${cleared.count} local commits for event ${EVENT_ID}`);

  const teams = await prisma.team.findMany({
    where: {
      eventId: EVENT_ID,
      githubRepoName: { not: null },
    },
  });

  for (const team of teams) {
    const repo = team.githubRepoName;
    console.log(`\nSync ${team.name} (${repo})`);
    let list;
    try {
      list = await gh(
        `https://api.github.com/repos/${ORG}/${repo}/commits?per_page=100`,
      );
    } catch (e) {
      console.log(`  skip: ${e.message}`);
      continue;
    }
    if (!Array.isArray(list)) {
      console.log('  no commits');
      continue;
    }

    let n = 0;
    for (const c of list) {
      const detail = await getCommitDetail(repo, c.sha);
      await prisma.githubCommit.upsert({
        where: {
          teamId_commitHash: { teamId: team.id, commitHash: c.sha },
        },
        create: {
          teamId: team.id,
          commitHash: c.sha,
          message: c.commit?.message || 'No message',
          pusher: detail.authorLogin || c.commit?.author?.name || 'Unknown',
          url: c.html_url,
          timestamp: new Date(c.commit?.author?.date || Date.now()),
          additions: detail.additions,
          deletions: detail.deletions,
          changedFiles: detail.changedFiles,
          files: detail.files ?? undefined,
          authorLogin: detail.authorLogin,
          authorName: detail.authorName,
        },
        update: {
          message: c.commit?.message || 'No message',
          pusher: detail.authorLogin || c.commit?.author?.name || 'Unknown',
          url: c.html_url,
          timestamp: new Date(c.commit?.author?.date || Date.now()),
          additions: detail.additions,
          deletions: detail.deletions,
          changedFiles: detail.changedFiles,
          files: detail.files ?? undefined,
          authorLogin: detail.authorLogin,
          authorName: detail.authorName,
        },
      });
      n += 1;
    }
    console.log(`  upserted ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
