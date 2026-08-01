"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { axiosClient } from "@/lib/axios";
import {
  GithubCommitCard,
  GithubSummaryBar,
  type GithubCommitRow,
  type GithubCommitSummary,
  type GithubRepoInsights,
} from "@/components/github/github-activity-stats";
import {
  ExternalLink,
  FileCode2,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { useSnackbar } from "notistack";

type AnalyticsPayload = {
  teamId: number;
  teamName: string;
  repoUrl: string;
  repoName: string;
  eventName?: string;
  members?: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    githubUsername?: string | null;
  }>;
  collaboratorStatus?: Array<{
    userId: number;
    name: string;
    email: string;
    githubUsername?: string | null;
    status: string;
    isLeader?: boolean;
  }>;
  authorMemberMap?: {
    authors: Array<{
      author: string;
      commits: number;
      additions: number;
      deletions: number;
      matchedMember: {
        id: number;
        name: string;
        email: string;
        role: string;
        githubUsername?: string | null;
      } | null;
    }>;
    unmatchedMembers: Array<{
      id: number;
      name: string;
      email: string;
      githubUsername?: string | null;
      role: string;
    }>;
  };
  insights?: GithubRepoInsights | null;
  activity?: {
    pullRequests: Array<{
      number: number;
      title: string;
      state: string;
      user: string | null;
      createdAt: string | null;
      mergedAt: string | null;
      htmlUrl: string;
      additions: number | null;
      deletions: number | null;
      changedFiles: number | null;
    }>;
    branches: Array<{ name: string; protected: boolean }>;
    workflowRuns: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      htmlUrl: string;
      createdAt: string | null;
      headBranch: string | null;
    }>;
    releases: Array<{
      id: number;
      tagName: string;
      name: string;
      publishedAt: string | null;
      htmlUrl: string;
      draft: boolean;
      prerelease: boolean;
    }>;
    openIssues: Array<{
      number: number;
      title: string;
      user: string | null;
      createdAt: string | null;
      htmlUrl: string;
      comments: number;
    }>;
    tags: Array<{ name: string; commitSha: string }>;
  };
  commitSummary?: GithubCommitSummary | null;
  analytics?: {
    commitsByDay: Array<{
      date: string;
      commits: number;
      additions: number;
      deletions: number;
      intensity: number;
    }>;
    commitsByHour?: Array<{
      hour: number;
      commits: number;
      additions: number;
      deletions: number;
    }>;
    commitsByAuthor: Array<{
      author: string;
      commits: number;
      additions: number;
      deletions: number;
    }>;
    topFiles: Array<{
      filename: string;
      touches: number;
      additions: number;
      deletions: number;
      primaryStatus?: string;
    }>;
    netLinesByDay?: Array<{
      date: string;
      net: number;
      cumulativeNet: number;
      additions: number;
      deletions: number;
    }>;
    totals: {
      commits: number;
      additions: number;
      deletions: number;
      netLines?: number;
      authors: number;
      activeDays: number;
    };
  };
  languageBars?: Array<{ name: string; bytes: number; percent: number }>;
  commits?: GithubCommitRow[];
};

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "accepted" || s === "merged" || s === "success" || s === "completed")
    return "border-emerald-500/40 text-emerald-700 bg-emerald-500/10";
  if (s === "pending" || s === "open" || s === "in_progress" || s === "queued")
    return "border-amber-500/40 text-amber-700 bg-amber-500/10";
  if (
    s === "missing" ||
    s === "closed" ||
    s === "failure" ||
    s === "cancelled" ||
    s.includes("no github")
  )
    return "border-rose-500/40 text-rose-700 bg-rose-500/10";
  return "border-border text-muted-foreground bg-muted/40";
}

function BarRow({
  label,
  value,
  max,
  right,
  color = "bg-orange-500",
}: {
  label: string;
  value: number;
  max: number;
  right?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground shrink-0">
          {right ?? value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function buildLinePoints(
  values: number[],
  w: number,
  h: number,
  padX: number,
  padY: number,
  max: number,
) {
  return values.map((v, i) => {
    const x =
      padX + (i * (w - padX * 2)) / Math.max(1, values.length - 1 || 1);
    const y = h - padY - (v / max) * (h - padY * 2);
    return { x, y, v };
  });
}

function areaPath(
  points: Array<{ x: number; y: number }>,
  h: number,
  padY: number,
) {
  if (!points.length) return "";
  const base = h - padY;
  return [
    `M ${points[0].x} ${base}`,
    ...points.map((p) => `L ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${base}`,
    "Z",
  ].join(" ");
}

function CommitsTimelineChart({
  days,
}: {
  days: NonNullable<AnalyticsPayload["analytics"]>["commitsByDay"];
}) {
  if (!days.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Chưa đủ dữ liệu commit theo ngày.
      </p>
    );
  }
  const max = Math.max(1, ...days.map((d) => d.commits));
  const w = Math.max(520, days.length * 36);
  const h = 180;
  const padX = 36;
  const padY = 28;
  const points = buildLinePoints(
    days.map((d) => d.commits),
    w,
    h,
    padX,
    padY,
    max,
  );
  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 text-xs mb-2 text-muted-foreground">
        <span className="text-orange-600 font-medium">● Commits / ngày</span>
        <span>peak {max}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-48">
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
        <path
          d={areaPath(points, h, padY)}
          fill="rgba(249,115,22,0.12)"
        />
        <polyline
          fill="none"
          stroke="rgb(249 115 22)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={poly}
        />
        {points.map((p, i) => (
          <g key={days[i].date}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="rgb(249 115 22)" />
            <title>
              {days[i].date}: {days[i].commits} commits (+{days[i].additions}/−
              {days[i].deletions})
            </title>
            {(i % Math.ceil(days.length / 6) === 0 || i === days.length - 1) && (
              <text
                x={p.x}
                y={h - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {days[i].date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function LinesChart({
  days,
}: {
  days: NonNullable<AnalyticsPayload["analytics"]>["commitsByDay"];
}) {
  if (!days.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Chưa có số line (Sync team để enrich +/-).
      </p>
    );
  }
  const max = Math.max(
    1,
    ...days.map((d) => Math.max(d.additions, d.deletions)),
  );
  const totalAdd = days.reduce((s, d) => s + d.additions, 0);
  const totalDel = days.reduce((s, d) => s + d.deletions, 0);
  const w = Math.max(520, days.length * 36);
  const h = 180;
  const padX = 40;
  const padY = 28;
  const addPts = buildLinePoints(
    days.map((d) => d.additions),
    w,
    h,
    padX,
    padY,
    max,
  );
  const delPts = buildLinePoints(
    days.map((d) => d.deletions),
    w,
    h,
    padX,
    padY,
    max,
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-4 text-xs mb-2">
        <span className="text-emerald-600 font-medium">
          ● Additions (+{totalAdd.toLocaleString()})
        </span>
        <span className="text-rose-600 font-medium">
          ● Deletions (−{totalDel.toLocaleString()})
        </span>
        <span className="text-muted-foreground">peak {max.toLocaleString()} lines/day</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-48">
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
        <path d={areaPath(addPts, h, padY)} fill="rgba(16,185,129,0.10)" />
        <path d={areaPath(delPts, h, padY)} fill="rgba(244,63,94,0.08)" />
        <polyline
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={addPts.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        <polyline
          fill="none"
          stroke="rgb(244 63 94)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={delPts.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {days.map((d, i) => (
          <g key={d.date}>
            <circle cx={addPts[i].x} cy={addPts[i].y} r="3" fill="rgb(16 185 129)" />
            <circle cx={delPts[i].x} cy={delPts[i].y} r="3" fill="rgb(244 63 94)" />
            <title>
              {d.date}: +{d.additions} / −{d.deletions} ({d.commits} commits)
            </title>
            {(i % Math.ceil(days.length / 6) === 0 || i === days.length - 1) && (
              <text
                x={addPts[i].x}
                y={h - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function NetLinesChart({
  days,
}: {
  days: NonNullable<AnalyticsPayload["analytics"]>["netLinesByDay"];
}) {
  if (!days?.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Chưa có net lines theo ngày.
      </p>
    );
  }
  const vals = days.map((d) => d.cumulativeNet);
  const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const w = Math.max(520, days.length * 36);
  const h = 180;
  const padX = 44;
  const padY = 28;
  const mid = h / 2;
  const points = days.map((d, i) => {
    const x = padX + (i * (w - padX * 2)) / Math.max(1, days.length - 1);
    const y = mid - (d.cumulativeNet / maxAbs) * (h / 2 - padY);
    return { x, y, ...d };
  });
  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");
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
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full h-48">
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
          points={poly}
        />
        {points.map((p) => (
          <g key={p.date}>
            <circle cx={p.x} cy={p.y} r="3" fill="rgb(37 99 235)" />
            <title>
              {p.date}: cumulative {p.cumulativeNet} (day net {p.net >= 0 ? "+" : ""}
              {p.net})
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function HourBars({
  hours,
}: {
  hours: NonNullable<AnalyticsPayload["analytics"]>["commitsByHour"];
}) {
  if (!hours?.length) return null;
  const max = Math.max(1, ...hours.map((h) => h.commits));
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Phân bố commit theo giờ (UTC) — xem team code tập trung lúc nào.
      </p>
      <div className="flex items-end gap-1 h-28">
        {hours.map((h) => (
          <div
            key={h.hour}
            className="flex-1 flex flex-col items-center gap-1 min-w-0"
            title={`${h.hour}:00 UTC · ${h.commits} commits · +${h.additions}/−${h.deletions}`}
          >
            <div
              className="w-full rounded-t bg-orange-500/80"
              style={{ height: `${Math.max(4, (h.commits / max) * 100)}%` }}
            />
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {h.hour}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamGithubAnalyticsDialog({
  teamId,
  teamName,
  open,
  onOpenChange,
}: {
  teamId: number | null;
  teamName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["githubTeamAnalytics", teamId],
    queryFn: async () => {
      const res = await axiosClient.get(`/github/repos/${teamId}/insights`);
      return (res.data?.data || res.data) as AnalyticsPayload;
    },
    enabled: open && !!teamId,
    staleTime: 30_000,
  });

  const syncTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosClient.post(`/github/repos/sync/${teamId}`);
      return res.data?.data || res.data;
    },
    onSuccess: (result) => {
      enqueueSnackbar(
        result?.message || "Synced this team only (saved GitHub quota)",
        { variant: "success" },
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["eventCommits"] });
      queryClient.invalidateQueries({ queryKey: ["teamCommits", teamId] });
      queryClient.invalidateQueries({ queryKey: ["githubTeamAnalytics", teamId] });
    },
    onError: (err: any) => {
      enqueueSnackbar(
        err?.response?.data?.message || "Failed to sync this team",
        { variant: "error" },
      );
    },
  });

  const authors = data?.analytics?.commitsByAuthor || [];
  const maxAuthor = Math.max(1, ...authors.map((a) => a.commits));
  const topFiles = data?.analytics?.topFiles || [];
  const maxFiles = Math.max(1, ...topFiles.map((f) => f.touches));
  const langs = data?.languageBars || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <FaGithub className="h-5 w-5 text-orange-500" />
            Chi tiết repo · {data?.teamName || teamName || `Team #${teamId}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải toàn bộ hoạt động GitHub của team…
          </div>
        ) : isError ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-sm text-rose-600">
              {(error as any)?.response?.data?.message ||
                "Không tải được dữ liệu repo team."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Thử lại
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {data.eventName && <span>{data.eventName} · </span>}
                <span className="font-mono">{data.repoName}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="orange"
                  size="sm"
                  onClick={() => syncTeamMutation.mutate()}
                  disabled={syncTeamMutation.isPending || !teamId}
                  className="gap-1.5"
                >
                  {syncTeamMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync team này
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={data.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Mở GitHub
                  </a>
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Sync chỉ gọi GitHub API cho team này — không sync cả event, tránh hết quota.
            </p>

            <GithubSummaryBar
              summary={data.commitSummary}
              insights={data.insights || undefined}
            />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: "Commits",
                  value: data.analytics?.totals.commits ?? 0,
                },
                {
                  label: "Authors",
                  value: data.analytics?.totals.authors ?? 0,
                },
                {
                  label: "Active days",
                  value: data.analytics?.totals.activeDays ?? 0,
                },
                {
                  label: "Lines +",
                  value: `+${(data.analytics?.totals.additions ?? 0).toLocaleString()}`,
                },
                {
                  label: "Lines -",
                  value: `−${(data.analytics?.totals.deletions ?? 0).toLocaleString()}`,
                },
                {
                  label: "Net lines",
                  value: `${(data.analytics?.totals.netLines ?? 0) >= 0 ? "+" : ""}${(data.analytics?.totals.netLines ?? 0).toLocaleString()}`,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border bg-muted/20 px-4 py-3"
                >
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="text-xl font-semibold tabular-nums mt-1">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {data.members && data.members.length > 0 && (
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Thành viên team
                </h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  {data.members.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border bg-background px-3 py-2 text-xs"
                    >
                      <p className="font-medium">
                        {m.name}{" "}
                        <span className="text-muted-foreground">({m.role})</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5">{m.email}</p>
                      <p className="mt-0.5">
                        GitHub:{" "}
                        {m.githubUsername ? (
                          <a
                            href={`https://github.com/${m.githubUsername}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-600 hover:underline"
                          >
                            @{m.githubUsername}
                          </a>
                        ) : (
                          <span className="text-rose-600">chưa link</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data.collaboratorStatus?.length || 0) > 0 && (
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-3">
                  Collaborator status trên GitHub
                </h4>
                <div className="space-y-2">
                  {data.collaboratorStatus!.map((c) => (
                    <div
                      key={c.userId}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">
                          {c.name}
                          {c.isLeader ? " · leader" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.email}
                          {c.githubUsername ? ` · @${c.githubUsername}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] uppercase tracking-wide rounded-md border px-2 py-0.5 ${statusBadgeClass(c.status)}`}
                      >
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.authorMemberMap && (
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="font-semibold">
                  Map author GitHub ↔ thành viên SEAL
                </h4>
                <div className="space-y-2">
                  {data.authorMemberMap.authors.map((a) => (
                    <div
                      key={a.author}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="font-medium">{a.author}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.commits} commits · +{a.additions}/−{a.deletions}
                        </p>
                      </div>
                      <span className="text-xs">
                        {a.matchedMember ? (
                          <span className="text-emerald-700">
                            = {a.matchedMember.name} ({a.matchedMember.role})
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            chưa khớp profile SEAL
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                {(data.authorMemberMap.unmatchedMembers?.length || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Chưa có commit (hoặc chưa link GitHub):{" "}
                    {data.authorMemberMap.unmatchedMembers
                      .map((m) => m.name)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-2">Commits theo ngày</h4>
                <CommitsTimelineChart
                  days={data.analytics?.commitsByDay || []}
                />
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-2">Additions / Deletions</h4>
                <LinesChart days={data.analytics?.commitsByDay || []} />
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-2">Cumulative net lines</h4>
                <NetLinesChart days={data.analytics?.netLinesByDay || []} />
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="font-semibold mb-2">Commit theo giờ (UTC)</h4>
                <HourBars hours={data.analytics?.commitsByHour || []} />
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="font-semibold">Đóng góp theo author</h4>
                {authors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có author.</p>
                ) : (
                  authors.map((a) => (
                    <BarRow
                      key={a.author}
                      label={a.author}
                      value={a.commits}
                      max={maxAuthor}
                      right={`${a.commits} · +${a.additions}/-${a.deletions}`}
                    />
                  ))
                )}
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <h4 className="font-semibold">Ngôn ngữ trong repo</h4>
                {langs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa lấy được languages (repo private cần GITHUB_TOKEN, hoặc
                    Sync lại).
                  </p>
                ) : (
                  langs.map((l) => (
                    <BarRow
                      key={l.name}
                      label={l.name}
                      value={l.percent}
                      max={100}
                      right={`${l.percent}%`}
                      color="bg-blue-500"
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <FileCode2 className="h-4 w-4" /> File được đụng nhiều nhất
              </h4>
              {topFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có chi tiết file — bấm &quot;Sync team này&quot; để enrich
                  +/- và danh sách file từ GitHub API.
                </p>
              ) : (
                topFiles.map((f) => (
                  <BarRow
                    key={f.filename}
                    label={`${f.primaryStatus ? `[${f.primaryStatus}] ` : ""}${f.filename}`}
                    value={f.touches}
                    max={maxFiles}
                    right={`${f.touches} touches · +${f.additions}/-${f.deletions}`}
                    color="bg-violet-500"
                  />
                ))
              )}
            </div>

            {data.activity && (
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="font-semibold">
                    Pull requests ({data.activity.pullRequests.length})
                  </h4>
                  {data.activity.pullRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có PR.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {data.activity.pullRequests.map((pr) => (
                        <a
                          key={pr.number}
                          href={pr.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border px-3 py-2 text-sm hover:border-orange-500/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">
                              #{pr.number} {pr.title}
                            </span>
                            <span
                              className={`shrink-0 text-[10px] uppercase rounded border px-1.5 py-0.5 ${statusBadgeClass(pr.state)}`}
                            >
                              {pr.state}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {pr.user || "?"}
                            {pr.mergedAt
                              ? ` · merged ${new Date(pr.mergedAt).toLocaleDateString()}`
                              : pr.createdAt
                                ? ` · ${new Date(pr.createdAt).toLocaleDateString()}`
                                : ""}
                          </p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="font-semibold">
                    GitHub Actions / CI ({data.activity.workflowRuns.length})
                  </h4>
                  {data.activity.workflowRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Chưa có workflow run (hoặc Actions tắt / token thiếu quyền).
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {data.activity.workflowRuns.map((r) => (
                        <a
                          key={r.id}
                          href={r.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border px-3 py-2 text-sm hover:border-orange-500/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{r.name}</span>
                            <span
                              className={`shrink-0 text-[10px] uppercase rounded border px-1.5 py-0.5 ${statusBadgeClass(r.conclusion || r.status)}`}
                            >
                              {r.conclusion || r.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.headBranch || "—"}
                            {r.createdAt
                              ? ` · ${new Date(r.createdAt).toLocaleString()}`
                              : ""}
                          </p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="font-semibold">
                    Branches ({data.activity.branches.length})
                  </h4>
                  {data.activity.branches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa lấy được branch.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {data.activity.branches.map((b) => (
                        <span
                          key={b.name}
                          className="rounded-md border px-2 py-1 text-xs font-mono"
                        >
                          {b.name}
                          {b.protected ? " · protected" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                  {(data.activity.tags.length > 0 ||
                    data.activity.releases.length > 0) && (
                    <div className="pt-3 border-t space-y-2">
                      {data.activity.tags.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {data.activity.tags.map((t) => (
                              <span
                                key={t.name}
                                className="rounded-md border px-2 py-0.5 text-[11px] font-mono"
                              >
                                {t.name}
                                {t.commitSha ? ` @${t.commitSha}` : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.activity.releases.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Releases</p>
                          <div className="space-y-1">
                            {data.activity.releases.map((r) => (
                              <a
                                key={r.id}
                                href={r.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs hover:text-orange-600"
                              >
                                {r.name || r.tagName}
                                {r.publishedAt
                                  ? ` · ${new Date(r.publishedAt).toLocaleDateString()}`
                                  : ""}
                                {r.draft ? " (draft)" : ""}
                                {r.prerelease ? " (pre)" : ""}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-4 space-y-2">
                  <h4 className="font-semibold">
                    Open issues ({data.activity.openIssues.length})
                  </h4>
                  {data.activity.openIssues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có open issue.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {data.activity.openIssues.map((i) => (
                        <a
                          key={i.number}
                          href={i.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border px-3 py-2 text-sm hover:border-orange-500/50"
                        >
                          <p className="font-medium truncate">
                            #{i.number} {i.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {i.user || "?"} · {i.comments} comments
                            {i.createdAt
                              ? ` · ${new Date(i.createdAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border p-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4" />
                Toàn bộ commit / việc team đã làm ({data.commits?.length || 0})
              </h4>
              {(data.commits?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Team chưa có commit trên hệ thống — bấm Sync team này.
                </p>
              ) : (
                <div className="relative border-l-2 border-border/60 ml-2 pl-5 space-y-5 max-h-[480px] overflow-y-auto pr-1">
                  {data.commits!.map((commit, index) => (
                    <GithubCommitCard
                      key={commit.id || commit.commitHash || index}
                      commit={commit}
                      isLatest={index === 0}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
