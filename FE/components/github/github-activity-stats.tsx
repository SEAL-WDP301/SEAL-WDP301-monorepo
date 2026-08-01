"use client";

import {
  Clock,
  ExternalLink,
  FileCode2,
  GitCommitHorizontal,
  Users,
} from "lucide-react";

export type GithubCommitRow = {
  id?: number | string;
  commitHash?: string;
  message?: string;
  url?: string;
  timestamp?: string | Date;
  pusher?: string;
  authorLogin?: string | null;
  authorName?: string | null;
  additions?: number | null;
  deletions?: number | null;
  changedFiles?: number | null;
  files?: Array<{
    filename: string;
    status?: string;
    additions?: number;
    deletions?: number;
  }> | null;
  teamId?: number;
  team?: { name?: string | null; githubRepoUrl?: string | null } | null;
};

export type GithubCommitSummary = {
  commitCount: number;
  authorCount: number;
  authors?: string[];
  additions: number;
  deletions: number;
  changedFilesEvents?: number;
  uniqueFiles?: number;
  topFiles?: string[];
};

export type GithubRepoInsights = {
  fullName?: string;
  htmlUrl?: string;
  description?: string | null;
  defaultBranch?: string | null;
  language?: string | null;
  languages?: Record<string, number>;
  stars?: number;
  forks?: number;
  watchers?: number;
  openIssues?: number;
  sizeKb?: number;
  createdAt?: string | null;
  pushedAt?: string | null;
  contributors?: Array<{
    login: string;
    contributions: number;
    avatarUrl?: string | null;
  }>;
  contributorCount?: number;
};

function fileStatusTone(status?: string) {
  const s = (status || "modified").toLowerCase();
  if (s === "added") return "border-emerald-500/40 text-emerald-700 bg-emerald-500/10";
  if (s === "removed") return "border-rose-500/40 text-rose-700 bg-rose-500/10";
  if (s === "renamed") return "border-blue-500/40 text-blue-700 bg-blue-500/10";
  return "border-border text-muted-foreground bg-muted/40";
}

export function normalizeGithubCommitsPayload(payload: unknown): {
  commits: GithubCommitRow[];
  summary?: GithubCommitSummary;
} {
  if (!payload) return { commits: [] };
  if (Array.isArray(payload)) return { commits: payload as GithubCommitRow[] };

  const root = payload as Record<string, unknown>;
  const layer1 =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const layer2 =
    layer1.data &&
    typeof layer1.data === "object" &&
    !Array.isArray(layer1.data) &&
    ("commits" in (layer1.data as object) ||
      "summary" in (layer1.data as object))
      ? (layer1.data as Record<string, unknown>)
      : layer1;

  const commits = Array.isArray(layer2.commits)
    ? (layer2.commits as GithubCommitRow[])
    : Array.isArray(layer2.data)
      ? (layer2.data as GithubCommitRow[])
      : Array.isArray(layer1.data)
        ? (layer1.data as GithubCommitRow[])
        : Array.isArray(root.data)
          ? (root.data as GithubCommitRow[])
          : [];

  const summary = (layer2.summary || layer1.summary || root.summary) as
    | GithubCommitSummary
    | undefined;

  return { commits, summary };
}

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red" | "orange";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
      : tone === "red"
        ? "text-rose-600 border-rose-500/30 bg-rose-500/10"
        : tone === "orange"
          ? "text-orange-600 border-orange-500/30 bg-orange-500/10"
          : "text-foreground border-border bg-muted/40";

  return (
    <div className={`rounded-xl border px-3 py-2 min-w-[110px] ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function GithubSummaryBar({
  summary,
  insights,
}: {
  summary?: GithubCommitSummary | null;
  insights?: GithubRepoInsights | null;
}) {
  if (!summary && !insights) return null;

  const langEntries = insights?.languages
    ? Object.entries(insights.languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];

  return (
    <div className="mb-5 space-y-3">
      {summary && (
        <div className="flex flex-wrap gap-2">
          <StatChip label="Commits" value={summary.commitCount} tone="orange" />
          <StatChip label="Authors" value={summary.authorCount} />
          <StatChip
            label="Additions"
            value={`+${summary.additions}`}
            tone="green"
          />
          <StatChip
            label="Deletions"
            value={`-${summary.deletions}`}
            tone="red"
          />
          <StatChip label="Unique files" value={summary.uniqueFiles ?? 0} />
        </div>
      )}

      {insights && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <a
                href={insights.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold hover:text-orange-500"
              >
                {insights.fullName || "Repository"}
              </a>
              {insights.description && (
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  {insights.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {insights.defaultBranch && (
                <span className="rounded-full border px-2 py-0.5">
                  branch: {insights.defaultBranch}
                </span>
              )}
              {insights.language && (
                <span className="rounded-full border px-2 py-0.5">
                  {insights.language}
                </span>
              )}
              <span className="rounded-full border px-2 py-0.5">
                ★ {insights.stars ?? 0}
              </span>
              <span className="rounded-full border px-2 py-0.5">
                forks {insights.forks ?? 0}
              </span>
              <span className="rounded-full border px-2 py-0.5">
                watchers {insights.watchers ?? 0}
              </span>
              <span className="rounded-full border px-2 py-0.5">
                issues {insights.openIssues ?? 0}
              </span>
              <span className="rounded-full border px-2 py-0.5">
                {insights.sizeKb ?? 0} KB
              </span>
              {insights.createdAt && (
                <span className="rounded-full border px-2 py-0.5">
                  created {new Date(insights.createdAt).toLocaleDateString()}
                </span>
              )}
              {insights.pushedAt && (
                <span className="rounded-full border px-2 py-0.5">
                  last push {new Date(insights.pushedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {langEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {langEntries.map(([lang, bytes]) => (
                <span
                  key={lang}
                  className="rounded-md bg-background border px-2 py-0.5 text-[11px]"
                >
                  {lang}: {bytes.toLocaleString()} B
                </span>
              ))}
            </div>
          )}

          {insights.contributors && insights.contributors.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {insights.contributors.slice(0, 8).map((c) => (
                <span
                  key={c.login}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]"
                  title={`${c.contributions} contributions`}
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : null}
                  {c.login}
                  <span className="text-muted-foreground">
                    ({c.contributions})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function resolveCommitUrl(commit: GithubCommitRow): string | null {
  if (commit.url && /^https?:\/\//i.test(commit.url)) return commit.url;
  const repo =
    (commit.team as { githubRepoUrl?: string | null } | null | undefined)
      ?.githubRepoUrl || null;
  const hash = commit.commitHash;
  if (repo && hash) return `${repo.replace(/\/$/, "")}/commit/${hash}`;
  return null;
}

export function GithubCommitCard({
  commit,
  showTeamName,
  isLatest,
}: {
  commit: GithubCommitRow;
  showTeamName?: boolean;
  isLatest?: boolean;
}) {
  const files = Array.isArray(commit.files) ? commit.files : [];
  const author =
    commit.authorLogin || commit.authorName || commit.pusher || "Unknown";
  const shortHash = (commit.commitHash || "").slice(0, 7);
  const commitUrl = resolveCommitUrl(commit);

  return (
    <div className="relative flex gap-4 text-sm">
      <div
        className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-background ${
          isLatest
            ? "bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]"
            : "bg-muted-foreground/30"
        }`}
      />
      <div className="flex-1 overflow-hidden bg-muted/20 p-4 rounded-xl border border-border/50 hover:bg-muted/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-foreground/90 min-w-0">
            {showTeamName && (
              <span className="text-blue-500 mr-2">
                [{commit.team?.name || "Team"}]
              </span>
            )}
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="text-orange-500 underline decoration-orange-500/40 underline-offset-2 hover:decoration-orange-500 transition-colors"
              >
                {commit.message}
              </a>
            ) : (
              <span>{commit.message}</span>
            )}
            {isLatest && (
              <span className="ml-2 text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider border border-orange-500/20">
                Latest
              </span>
            )}
          </p>
          {commitUrl ? (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-orange-500/35 bg-orange-500/10 px-2 py-1 text-[11px] font-semibold text-orange-600 hover:bg-orange-500/20"
            >
              Mở commit
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {commit.timestamp
              ? new Date(commit.timestamp).toLocaleString()
              : "—"}
          </span>
          <span className="font-medium text-orange-500">{author}</span>
          {shortHash &&
            (commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-orange-600 hover:underline"
                title="Mở commit trên GitHub"
              >
                <GitCommitHorizontal className="h-3 w-3" />
                {shortHash}
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono">
                <GitCommitHorizontal className="h-3 w-3" />
                {shortHash}
              </span>
            ))}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold tabular-nums text-emerald-700">
            +
            {typeof commit.additions === "number"
              ? commit.additions.toLocaleString()
              : "?"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold tabular-nums text-rose-700">
            −
            {typeof commit.deletions === "number"
              ? commit.deletions.toLocaleString()
              : "?"}
          </span>
          <span className="inline-flex items-center gap-1">
            <FileCode2 className="h-3 w-3" />
            {typeof commit.changedFiles === "number"
              ? `${commit.changedFiles} files`
              : files.length > 0
                ? `${files.length} files`
                : "— files"}
          </span>
        </div>

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {files.slice(0, 12).map((f) => (
              <span
                key={`${commit.commitHash}-${f.filename}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-[11px] font-mono"
              >
                <span
                  className={`rounded px-1 py-px text-[9px] uppercase tracking-wide border ${fileStatusTone(f.status)}`}
                >
                  {(f.status || "mod").slice(0, 3)}
                </span>
                <span className="truncate max-w-[160px]">{f.filename}</span>
                <span className="text-emerald-600 tabular-nums">
                  +{f.additions ?? 0}
                </span>
                <span className="text-rose-600 tabular-nums">
                  −{f.deletions ?? 0}
                </span>
              </span>
            ))}
            {files.length > 12 && (
              <span className="text-[11px] text-muted-foreground px-1 py-0.5">
                +{files.length - 12} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
