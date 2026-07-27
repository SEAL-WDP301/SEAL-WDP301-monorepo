"use client";

import Link from "next/link";
import { CalendarPlus2, CheckCircle2, PlayCircle, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardSection } from "./dashboard-section";
import type { EventMonthlyMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber } from "@/lib/admin-dashboard/dashboard-formatters";

const summaryItems = [
  { key: "Created", label: "Created", icon: CalendarPlus2, color: "#f97316", tone: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  { key: "Starting", label: "Starting", icon: PlayCircle, color: "#3b82f6", tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { key: "Completed", label: "Completed", icon: CheckCircle2, color: "#10b981", tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
] as const;

export function EventsByMonthChart({ data }: { data: EventMonthlyMetric[] }) {
  const totals = summaryItems.map((item) => ({
    ...item,
    value: data.reduce((sum, month) => sum + month[item.key], 0),
  }));
  const totalEvents = totals.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(1, ...data.flatMap((month) => [month.Created, month.Starting, month.Completed]));
  const peakMonth = data.reduce<EventMonthlyMetric | null>((peak, month) => {
    const monthTotal = month.Created + month.Starting + month.Completed;
    const peakTotal = peak ? peak.Created + peak.Starting + peak.Completed : -1;
    return monthTotal > peakTotal ? month : peak;
  }, null);

  return (
    <DashboardSection
      title="Events by Month"
      description="Creation, launch, and completion volume across the selected year"
      action={<Button asChild variant="outline" size="sm"><Link href="/organizer/events">View all events</Link></Button>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className={`grid size-9 place-items-center rounded-xl border ${item.tone}`}><Icon className="size-4" /></div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{item.label}</span>
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight">{formatNumber(item.value)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{totalEvents ? Math.round((item.value / totalEvents) * 100) : 0}% of yearly activity</p>
            </div>
          );
        })}
      </div>

      {data.length > 0 ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-5 flex flex-wrap gap-4 text-xs font-medium">
              {summaryItems.map((item) => <span key={item.key} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
            </div>
            <div className="flex h-64 min-w-[560px] items-end gap-3 border-b border-border px-2 pt-4">
              {data.map((month) => (
                <div key={month.month} className="flex h-full min-w-12 flex-1 flex-col justify-end">
                  <div className="flex flex-1 items-end justify-center gap-1.5">
                    {summaryItems.map((item) => {
                      const value = month[item.key];
                      return <div key={item.key} title={`${month.month} · ${item.label}: ${value}`} className="w-full max-w-7 rounded-t-md transition-opacity hover:opacity-80" style={{ height: value > 0 ? `${Math.max((value / maxValue) * 100, 4)}%` : "2px", backgroundColor: value > 0 ? item.color : "var(--border)" }} />;
                    })}
                  </div>
                  <p className="mt-3 truncate text-center text-[11px] font-medium text-muted-foreground">{month.month}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground"><TrendingUp className="size-4 text-orange-500" />Peak activity: {peakMonth?.month || "—"}</span>
            <span className="text-muted-foreground">{totalEvents} total lifecycle movements recorded</span>
          </div>
        </>
      ) : <DashboardEmptyState message="No monthly event activity for the selected year." />}
    </DashboardSection>
  );
}
