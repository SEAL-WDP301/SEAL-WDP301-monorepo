"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import {
  GithubCommitCard,
  type GithubCommitRow,
} from "@/components/github/github-activity-stats";
import {
  Activity,
  Clock,
  ExternalLink,
  GitCommitHorizontal,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

export type EventGithubDashboardData = {
  eventId: number;
  eventName: string;
  githubOrgUrl?: string | null;
  tokenConfigured?: boolean;
  totals: {
    teamsTotal?: number;
    teamsWithRepo: number;
    teamsWithActivity: number;
    teamsIdle: number;
    teamsNoRepo?: number;
    commits: number;
    additions: number;
    deletions: number;
    netLines: number;
    authors: number;
    uniqueFiles?: number;
    filesAdded?: number;
    filesModified?: number;
    filesRemoved?: number;
  };
  teams: Array<{
    teamId: number;
    teamName: string;
    repoUrl: string | null;
    repoName: string | null;
    hasRepo?: boolean;
    leaderName: string | null;
    memberCount: number;
    commitCount: number;
    authorCount: number;
    additions: number;
    deletions: number;
    netLines: number;
    uniqueFiles: number;
    filesAdded?: number;
    filesModified?: number;
    filesRemoved?: number;
    lastCommitAt: string | Date | null;
    lastCommitMessage: string | null;
    lastAuthor: string | null;
    hasActivity: boolean;
    sparkline?: Array<{ date: string; commits: number }>;
  }>;
  commitsByTeam: Array<{
    teamId: number;
    teamName: string;
    commits: number;
    additions: number;
    deletions: number;
    netLines: number;
  }>;
  topFiles?: Array<{
    filename: string;
    touches: number;
    additions: number;
    deletions: number;
    added: number;
    modified: number;
    removed: number;
  }>;
  activityByDay: Array<{
    date: string;
    commits: number;
    additions: number;
    deletions: number;
  }>;
  netLinesByDay?: Array<{
    date: string;
    net: number;
    cumulativeNet: number;
    additions: number;
    deletions: number;
  }>;
  activityByHour?: Array<{
    hour: number;
    commits: number;
    additions: number;
    deletions: number;
  }>;
  teamRace?: Array<{
    teamId: number;
    teamName: string;
    points: Array<{ date: string; commits: number }>;
  }>;
  chartWindow?: {
    dates: string[];
    dayCount: number;
    startDate: string | null;
    endDate: string | null;
  };
  recentCommits: GithubCommitRow[];
};

const RACE_COLORS = [
  "rgb(249 115 22)",
  "rgb(37 99 235)",
  "rgb(16 185 129)",
  "rgb(168 85 247)",
  "rgb(244 63 94)",
];

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "red" | "orange" | "blue" | "muted";
  hint?: string;
}) {
  const cls =
    tone === "green"
      ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/35 text-emerald-800 dark:text-emerald-300"
      : tone === "red"
        ? "from-rose-500/20 to-rose-500/5 border-rose-500/35 text-rose-800 dark:text-rose-300"
        : tone === "orange"
          ? "from-orange-500/25 to-orange-500/5 border-orange-500/40 text-orange-800 dark:text-orange-300"
          : tone === "blue"
            ? "from-sky-500/20 to-sky-500/5 border-sky-500/35 text-sky-800 dark:text-sky-300"
            : "from-muted/80 to-muted/30 border-border text-foreground";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br px-4 py-3 shadow-sm ${cls}`}
    >
      <div className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-white/20 blur-xl" />
      <p className="text-[10px] uppercase tracking-[0.14em] opacity-70 relative">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums mt-1 relative tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] opacity-60 mt-0.5 relative">{hint}</p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
  className = "",
  wide,
  action,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-orange-500/15 bg-card/80 backdrop-blur-sm shadow-[0_8px_30px_-18px_rgba(243,112,33,0.45)] ${wide ? "lg:col-span-2" : ""} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-orange-500/10 px-4 py-3 bg-gradient-to-r from-orange-500/10 via-transparent to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h4 className="font-semibold tracking-tight truncate">{title}</h4>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TeamCompareBars({
  rows,
  valueKey,
  color,
}: {
  rows: EventGithubDashboardData["commitsByTeam"];
  valueKey: "commits" | "additions" | "netLines";
  color: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No data to compare.
      </p>
    );
  }
  const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r[valueKey] || 0))));
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {rows.map((r) => {
        const v = Number(r[valueKey] || 0);
        const pct = Math.max(4, Math.round((Math.abs(v) / max) * 100));
        return (
          <div key={`${valueKey}-${r.teamId}`} className="space-y-1">
            <div className="flex justify-between gap-2 text-xs">
              <span className="truncate font-medium">{r.teamName}</span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {valueKey === "netLines" && v > 0 ? "+" : ""}
                {v.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-700`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({
  points,
}: {
  points: Array<{ date: string; commits: number }>;
}) {
  if (!points?.length) return null;
  const w = 72;
  const h = 24;
  const max = Math.max(1, ...points.map((p) => p.commits));
  const coords = points.map((p, i) => {
    const x = (i * w) / Math.max(1, points.length - 1);
    const y = h - 2 - (p.commits / max) * (h - 4);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[72px] h-6 inline-block">
      <polyline
        fill="none"
        stroke="rgb(249 115 22)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

function MultiLineChart({
  days,
  series,
}: {
  days: Array<{ date: string; commits: number; additions: number; deletions: number }>;
  series: Array<{ key: "commits" | "additions" | "deletions"; color: string; label: string }>;
}) {
  if (!days.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No daily activity — Sync teams for chart data.
      </p>
    );
  }
  const max = Math.max(
    1,
    ...days.flatMap((d) => series.map((s) => Number(d[s.key] || 0))),
  );
  const w = Math.max(520, days.length * 36);
  const h = 200;
  const padX = 40;
  const padY = 28;

  const toPoints = (key: "commits" | "additions" | "deletions") =>
    days.map((d, i) => {
      const x = padX + (i * (w - padX * 2)) / Math.max(1, days.length - 1);
      const y = h - padY - (Number(d[key] || 0) / max) * (h - padY * 2);
      return { x, y, v: Number(d[key] || 0), date: d.date };
    });

  const area = (pts: Array<{ x: number; y: number }>) => {
    if (!pts.length) return "";
    const base = h - padY;
    return `M ${pts[0].x} ${base} ${pts.map((p) => `L ${p.x} ${p.y}`).join(" ")} L ${pts[pts.length - 1].x} ${base} Z`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-4 text-xs mb-2">
        {series.map((s) => (
          <span key={s.key} style={{ color: s.color }} className="font-medium">
            ● {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-52">
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = h - padY - t * (h - padY * 2);
          return (
            <g key={t}>
              <line
                x1={padX}
                x2={w - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="4 4"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                className="fill-muted-foreground"
              >
                {Math.round(max * t)}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => {
          const pts = toPoints(s.key);
          return (
            <g key={s.key}>
              {si === 0 && (
                <path d={area(pts)} fill={s.color} fillOpacity={0.08} />
              )}
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                className="animate-in fade-in duration-700"
              />
              {pts.map((p) => (
                <circle
                  key={`${s.key}-${p.date}`}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill={s.color}
                >
                  <title>
                    {p.date}: {s.label} {p.v.toLocaleString()}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {days.map((d, i) =>
          i % Math.ceil(days.length / 6) === 0 || i === days.length - 1 ? (
            <text
              key={d.date}
              x={padX + (i * (w - padX * 2)) / Math.max(1, days.length - 1)}
              y={h - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-muted-foreground"
            >
              {d.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function NetCumulativeChart({
  days,
}: {
  days: NonNullable<EventGithubDashboardData["netLinesByDay"]>;
}) {
  if (!days?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No cumulative net lines.
      </p>
    );
  }
  const vals = days.map((d) => d.cumulativeNet);
  const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const w = Math.max(520, days.length * 36);
  const h = 200;
  const padX = 44;
  const padY = 28;
  const mid = h / 2;
  const points = days.map((d, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(1, days.length - 1);
    const y = mid - (d.cumulativeNet / maxAbs) * (h / 2 - padY);
    return { x, y, ...d };
  });
  const last = days[days.length - 1]?.cumulativeNet ?? 0;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 text-xs mb-2">
        <span className="text-blue-600 font-medium">● Cumulative net lines</span>
        <span className={last >= 0 ? "text-emerald-600" : "text-rose-600"}>
          now {last >= 0 ? "+" : ""}
          {last.toLocaleString()}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-52">
        <line
          x1={padX}
          x2={w - padX}
          y1={mid}
          y2={mid}
          stroke="currentColor"
          className="text-border"
        />
        <polyline
          fill="none"
          stroke="rgb(37 99 235)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r="3" fill="rgb(37 99 235)">
            <title>
              {p.date}: cumulative {p.cumulativeNet} (day{" "}
              {p.net >= 0 ? "+" : ""}
              {p.net})
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function TeamRaceChart({
  race,
}: {
  race: NonNullable<EventGithubDashboardData["teamRace"]>;
}) {
  if (!race?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Not enough active teams for race chart.
      </p>
    );
  }
  const dates = race[0]?.points.map((p) => p.date) || [];
  const max = Math.max(
    1,
    ...race.flatMap((t) => t.points.map((p) => p.commits)),
  );
  const w = Math.max(520, dates.length * 36);
  const h = 220;
  const padX = 40;
  const padY = 28;

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-3 text-xs mb-2">
        {race.map((t, i) => (
          <span
            key={t.teamId}
            className="font-medium"
            style={{ color: RACE_COLORS[i % RACE_COLORS.length] }}
          >
            ● {t.teamName}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-56">
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = h - padY - t * (h - padY * 2);
          return (
            <line
              key={t}
              x1={padX}
              x2={w - padX}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-border"
              strokeDasharray="4 4"
            />
          );
        })}
        {race.map((team, ti) => {
          const color = RACE_COLORS[ti % RACE_COLORS.length];
          const pts = team.points.map((p, i) => {
            const x =
              padX + (i * (w - padX * 2)) / Math.max(1, dates.length - 1);
            const y = h - padY - (p.commits / max) * (h - padY * 2);
            return { x, y, ...p };
          });
          return (
            <g key={team.teamId}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              />
              {pts.map((p) => (
                <circle key={p.date} cx={p.x} cy={p.y} r="3" fill={color}>
                  <title>
                    {team.teamName} · {p.date}: {p.commits} commits
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        {dates.map((d, i) =>
          i % Math.ceil(dates.length / 6) === 0 || i === dates.length - 1 ? (
            <text
              key={d}
              x={padX + (i * (w - padX * 2)) / Math.max(1, dates.length - 1)}
              y={h - 8}
              textAnchor="middle"
              fontSize="10"
              className="fill-muted-foreground"
            >
              {d.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function HourBars({
  hours,
}: {
  hours: NonNullable<EventGithubDashboardData["activityByHour"]>;
}) {
  if (!hours?.length) return null;
  const max = Math.max(1, ...hours.map((h) => h.commits));
  const barMaxPx = 112;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Commits by hour (UTC) — see when teams code most.
      </p>
      <div className="flex items-end gap-0.5 sm:gap-1 h-36">
        {hours.map((h) => {
          const px = h.commits
            ? Math.max(6, Math.round((h.commits / max) * barMaxPx))
            : 2;
          return (
            <div
              key={h.hour}
              className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full"
              title={`${h.hour}:00 UTC · ${h.commits} commits · +${h.additions}/−${h.deletions}`}
            >
              {h.commits > 0 ? (
                <span className="text-[9px] font-semibold tabular-nums text-orange-600 leading-none">
                  {h.commits}
                </span>
              ) : (
                <span className="text-[9px] leading-none opacity-0">0</span>
              )}
              <div
                className={`w-full max-w-[14px] mx-auto rounded-t transition-all duration-500 ${
                  h.commits
                    ? "bg-orange-500 shadow-[0_0_12px_-2px_rgba(243,112,33,0.7)]"
                    : "bg-muted-foreground/20"
                }`}
                style={{ height: `${px}px` }}
              />
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {h.hour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventGithubDashboard({
  eventId,
  onOpenTeam,
  onSyncTeam,
  syncingTeamId,
}: {
  eventId: string | number;
  onOpenTeam: (team: { id: number; name: string }) => void;
  onSyncTeam: (teamId: number) => void;
  syncingTeamId?: number | null;
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["eventGithubDashboard", eventId],
    queryFn: async () => {
      const res = await axiosClient.get(
        `/github/repos/event/${eventId}/dashboard`,
      );
      return (res.data?.data || res.data) as EventGithubDashboardData;
    },
    staleTime: 20_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading dashboard for all repos…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-sm text-rose-600">
          {(error as any)?.response?.data?.message ||
            "Failed to load global GitHub dashboard."}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const t = data.totals;
  const activePct =
    t.teamsWithRepo > 0
      ? Math.round((t.teamsWithActivity / t.teamsWithRepo) * 100)
      : 0;

  return (
    <div className="relative">
      {/* Supply-chain route atmosphere */}
      <div className="pointer-events-none absolute inset-0 seal-grid opacity-60" />
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -left-16 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative space-y-6 p-5 sm:p-6">
        {/* Brand banner */}
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/30 bg-[linear-gradient(135deg,#1a1410_0%,#2a1a12_45%,#f37021_140%)] text-white shadow-[0_20px_60px_-24px_rgba(243,112,33,0.65)]">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 20%, rgba(243,112,33,0.35), transparent 35%)",
            }}
          />
          {/* route dots */}
          <svg
            className="absolute inset-x-0 bottom-0 h-16 w-full opacity-40"
            viewBox="0 0 800 64"
            preserveAspectRatio="none"
          >
            <path
              d="M0 40 C120 10, 200 60, 320 28 S520 8, 640 36 S740 50, 800 22"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2"
              strokeDasharray="6 8"
            />
            {[80, 220, 360, 500, 640, 760].map((x) => (
              <circle key={x} cx={x} cy={x % 120 === 0 ? 28 : 36} r="4" fill="#f37021" />
            ))}
          </svg>

          <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-7 sm:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                <Package className="h-3.5 w-3.5 text-orange-300" />
                Supply Chain · SEAL 2026
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {data.eventName || "Supply Chain SEAL 2026"}
              </h3>
              <p className="text-sm text-white/75 leading-relaxed">
                Live GitHub control tower — track all team repos on the race track
                {data.chartWindow?.dayCount
                  ? ` · ${data.chartWindow.dayCount} competition days`
                  : ""}
                {data.chartWindow?.startDate && data.chartWindow?.endDate
                  ? ` (${data.chartWindow.startDate.slice(5)} → ${data.chartWindow.endDate.slice(5)})`
                  : ""}
                {data.tokenConfigured
                  ? " · GitHub link OK"
                  : " · need GITHUB_TOKEN to Sync"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="orange"
                size="sm"
                className="gap-1.5 shadow-lg"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh live
              </Button>
              <div className="rounded-xl border border-white/15 bg-black/25 px-4 py-2 text-right backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-white/60">
                  Teams shipping
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {t.teamsWithActivity}/{t.teamsWithRepo}{" "}
                  <span className="text-sm font-medium text-orange-300">
                    ({activePct}%)
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Repos" value={t.teamsWithRepo} tone="orange" hint="có GitHub" />
          <Kpi label="Committed" value={t.teamsWithActivity} tone="green" hint="đã đẩy code" />
          <Kpi label="Uncommitted" value={t.teamsIdle} tone="red" hint="có repo, chưa commit" />
          <Kpi label="Commits" value={t.commits} tone="blue" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Panel
            title="Pulse theo ngày thi"
            icon={<TrendingUp className="h-4 w-4 text-orange-500" />}
          >
            <MultiLineChart
              days={data.activityByDay}
              series={[
                { key: "commits", color: "rgb(243 112 33)", label: "Commits" },
                {
                  key: "additions",
                  color: "rgb(16 185 129)",
                  label: "Additions",
                },
                {
                  key: "deletions",
                  color: "rgb(244 63 94)",
                  label: "Deletions",
                },
              ]}
            />
          </Panel>
          <Panel
            title="Cumulative net lines"
            icon={<Activity className="h-4 w-4 text-sky-500" />}
          >
            <NetCumulativeChart days={data.netLinesByDay || []} />
          </Panel>
          <Panel
            title="Team race — commits/ngày (top 5)"
            icon={<FaGithub className="h-4 w-4 text-orange-500" />}
            wide
          >
            <TeamRaceChart race={data.teamRace || []} />
          </Panel>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Panel
            title="Commits theo team"
            icon={<GitCommitHorizontal className="h-4 w-4 text-orange-500" />}
          >
            <TeamCompareBars
              rows={data.commitsByTeam}
              valueKey="commits"
              color="bg-orange-500"
            />
          </Panel>
          <Panel title="Additions theo team">
            <TeamCompareBars
              rows={data.commitsByTeam}
              valueKey="additions"
              color="bg-emerald-500"
            />
          </Panel>
          <Panel title="Giờ code (UTC)" icon={<Clock className="h-4 w-4 text-orange-500" />}>
            <HourBars hours={data.activityByHour || []} />
          </Panel>
        </div>

        <Panel
          title="Top committed files (added / modified / removed)"
          icon={<Package className="h-4 w-4 text-orange-500" />}
        >
          {(data.topFiles || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No file-level data in commits.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-medium px-2 py-2">File</th>
                    <th className="text-right font-medium px-2 py-2">Touches</th>
                    <th className="text-right font-medium px-2 py-2">+ / −</th>
                    <th className="text-right font-medium px-2 py-2">A / M / R</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.topFiles || []).map((f) => (
                    <tr key={f.filename} className="border-b last:border-0">
                      <td className="px-2 py-2 font-mono text-xs truncate max-w-[360px]">
                        {f.filename}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {f.touches}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs">
                        <span className="text-emerald-600">+{f.additions}</span>{" "}
                        <span className="text-rose-600">−{f.deletions}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        <span className="text-emerald-700">{f.added}</span>
                        {" / "}
                        <span className="text-sky-700">{f.modified}</span>
                        {" / "}
                        <span className="text-rose-700">{f.removed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="rounded-2xl border border-orange-500/20 overflow-hidden bg-card/90 shadow-[0_12px_40px_-20px_rgba(243,112,33,0.5)]">
          <div className="px-4 py-3 border-b border-orange-500/15 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent flex items-center justify-between gap-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              Fleet repos · {data.teams.length} teams
            </h4>
            <p className="text-xs text-muted-foreground">
              Competition days sparkline · click row → details
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b bg-muted/30">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">#</th>
                  <th className="text-left font-medium px-3 py-2.5">Team</th>
                  <th className="text-left font-medium px-3 py-2.5">Trend</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-left font-medium px-3 py-2.5">Repo</th>
                  <th className="text-right font-medium px-3 py-2.5">Commits</th>
                  <th className="text-right font-medium px-3 py-2.5">Files</th>
                  <th className="text-right font-medium px-3 py-2.5">Authors</th>
                  <th className="text-right font-medium px-3 py-2.5">+/-</th>
                  <th className="text-left font-medium px-3 py-2.5">Last commit</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No teams in the event yet.
                    </td>
                  </tr>
                ) : (
                  data.teams.map((team, idx) => (
                    <tr
                      key={team.teamId}
                      className="border-b last:border-0 odd:bg-orange-500/[0.03] hover:bg-orange-500/10 cursor-pointer transition-colors"
                      onClick={() =>
                        onOpenTeam({ id: team.teamId, name: team.teamName })
                      }
                    >
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{team.teamName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {team.leaderName || "—"} · {team.memberCount} members
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Sparkline points={team.sparkline || []} />
                      </td>
                      <td className="px-3 py-3">
                        {team.hasActivity ? (
                          <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Committed
                          </span>
                        ) : team.hasRepo !== false && (team.repoUrl || team.repoName) ? (
                          <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Uncommitted
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-400/40 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            No repo
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {team.repoUrl ? (
                          <a
                            href={team.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-orange-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {team.repoName || "repo"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">
                        {team.commitCount}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        <span className="font-semibold">{team.uniqueFiles}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          +{team.filesAdded ?? 0}/~{team.filesModified ?? 0}/−
                          {team.filesRemoved ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {team.authorCount}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        <span className="text-emerald-600 font-medium">
                          +{team.additions.toLocaleString()}
                        </span>{" "}
                        <span className="text-rose-600 font-medium">
                          −{team.deletions.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground max-w-[220px]">
                        {team.lastCommitAt ? (
                          <>
                            <p className="truncate text-foreground/85 font-medium">
                              {team.lastCommitMessage}
                            </p>
                            <p>
                              {team.lastAuthor} ·{" "}
                              {new Date(team.lastCommitAt).toLocaleString()}
                            </p>
                          </>
                        ) : (
                          "No commits yet"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] border-orange-500/30 hover:bg-orange-500/10"
                          disabled={syncingTeamId === team.teamId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSyncTeam(team.teamId);
                          }}
                        >
                          {syncingTeamId === team.teamId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Sync"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Panel
          title="Recent activity — all teams"
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          action={
            data.githubOrgUrl ? (
              <a
                href={data.githubOrgUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-orange-600 hover:text-orange-500 hover:underline"
              >
                <FaGithub className="h-3.5 w-3.5" />
                Open GitHub org
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null
          }
        >
          {data.recentCommits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 py-10 text-center">
              <FaGithub className="mx-auto h-8 w-8 text-orange-500/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No commits on the race track yet. Sync each team or wait for webhook.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-orange-500/30 ml-2 pl-5 space-y-5 max-h-[420px] overflow-y-auto pr-1">
              {data.recentCommits.map((commit, index) => (
                <div key={commit.id || commit.commitHash || index}>
                  <GithubCommitCard
                    commit={commit}
                    showTeamName
                    isLatest={index === 0}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {commit.url ? (
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
                      >
                        View on GitHub
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {commit.teamId ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-orange-600 hover:underline font-medium"
                        onClick={() =>
                          onOpenTeam({
                            id: Number(commit.teamId),
                            name: String(
                              commit.team?.name || `Team ${commit.teamId}`,
                            ),
                          })
                        }
                      >
                        Open team dashboard
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
