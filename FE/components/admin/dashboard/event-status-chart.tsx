"use client";

import Link from "next/link";

import { DashboardSection } from "./dashboard-section";
import type { EventStatusMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatPercent } from "@/lib/admin-dashboard/dashboard-formatters";

const statusColors: Record<string, string> = {
  draft: "#94a3b8",
  active: "#f97316",
  ongoing: "#3b82f6",
  completed: "#10b981",
  closed: "#10b981",
  cancelled: "#ef4444",
  upcoming: "#8b5cf6",
  registration_open: "#f59e0b",
  "registration open": "#f59e0b",
};

export function EventStatusChart({ data }: { data: EventStatusMetric[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = data.filter((item) => item.value > 0).map((item) => {
    const start = cursor;
    cursor += total ? (item.value / total) * 100 : 0;
    return `${statusColors[item.status.toLowerCase()] ?? "#64748b"} ${start}% ${cursor}%`;
  });
  const donutBackground = total > 0 ? `conic-gradient(${segments.join(", ")})` : "var(--muted)";

  return (
    <DashboardSection title="Event Status Distribution" description="Current lifecycle mix across all events">
      <div className="mx-auto grid size-56 place-items-center rounded-full p-7 shadow-inner" style={{ background: donutBackground }}>
        <div className="grid size-full place-items-center rounded-full border border-border bg-card text-center shadow-lg">
          <div><p className="text-3xl font-bold">{total}</p><p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">EVENTS</p></div>
        </div>
      </div>
      <div className="mt-5 grid gap-1.5">
        {data.map((item) => {
          const color = statusColors[item.status.toLowerCase()] ?? "#64748b";
          return <Link key={item.status} href="/organizer/events" className="flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors hover:bg-muted"><span className="flex min-w-0 items-center gap-2.5"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate">{item.status.replaceAll("_", " ")}</span></span><span className="font-medium text-muted-foreground">{item.value} · {formatPercent(total ? (item.value / total) * 100 : 0)}</span></Link>;
        })}
      </div>
    </DashboardSection>
  );
}
