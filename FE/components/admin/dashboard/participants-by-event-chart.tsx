"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, FileCheck2, Gauge, Users, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardSection } from "./dashboard-section";
import type { ParticipantsByEventMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber, formatPercent } from "@/lib/admin-dashboard/dashboard-formatters";

export function ParticipantsByEventChart({ data }: { data: ParticipantsByEventMetric[] }) {
  const [limit, setLimit] = useState("5");
  const ranked = useMemo(
    () => [...data].sort((a, b) => b.Participants - a.Participants),
    [data]
  );
  const visible = ranked.slice(0, Number(limit));
  const maxAudience = Math.max(1, ...visible.flatMap((item) => [item.Participants, item.registrations]));
  const totals = visible.reduce(
    (result, item) => ({
      participants: result.participants + item.Participants,
      registrations: result.registrations + item.registrations,
      teams: result.teams + item.teams,
      submissions: result.submissions + item.submissions,
    }),
    { participants: 0, registrations: 0, teams: 0, submissions: 0 }
  );

  return (
    <DashboardSection
      title="Participants by Event"
      description="Compare event reach, conversion, team formation, and submission activity"
      action={
        <Select value={limit} onValueChange={(value) => value && setLimit(value)}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Top 5</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {visible.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Participants", value: totals.participants, icon: Users, color: "text-orange-500" },
              { label: "Registrations", value: totals.registrations, icon: Gauge, color: "text-blue-500" },
              { label: "Teams", value: totals.teams, icon: UsersRound, color: "text-violet-500" },
              { label: "Submissions", value: totals.submissions, icon: FileCheck2, color: "text-emerald-500" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                  <div className={`grid size-9 place-items-center rounded-lg bg-muted ${item.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none">{formatNumber(item.value)}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-5 flex flex-wrap gap-4 text-xs font-medium">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-orange-500" />Approved participants</span>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-blue-500" />All registrations</span>
            </div>
            <div className="space-y-5">
              {visible.map((item) => (
                <div key={item.id} className="grid gap-2 lg:grid-cols-[minmax(180px,280px)_1fr] lg:items-center lg:gap-5">
                  <Link href={`/organizer/events/${item.id}/overview`} className="truncate text-sm font-semibold hover:text-orange-500" title={item.event}>{item.event}</Link>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3"><span className="w-8 text-right text-xs font-bold text-orange-500">{item.Participants}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400" style={{ width: `${(item.Participants / maxAudience) * 100}%` }} /></div></div>
                    <div className="flex items-center gap-3"><span className="w-8 text-right text-xs font-bold text-blue-500">{item.registrations}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${(item.registrations / maxAudience) * 100}%` }} /></div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item, index) => {
              const capacityRate = item.capacity > 0 ? (item.Participants / item.capacity) * 100 : 0;
              const submissionRate = item.Participants > 0 ? (item.submissions / item.Participants) * 100 : 0;
              return (
                <Link
                  href={`/organizer/events/${item.id}/overview`}
                  key={item.id}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5"
                >
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-500 via-amber-400 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-xs font-bold text-orange-500">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-orange-500">{item.event}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.teams} teams · {item.submissions} submissions</p>
                      </div>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-orange-500" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Participants</p>
                      <p className="mt-1 text-lg font-bold">{formatNumber(item.Participants)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Registered</p>
                      <p className="mt-1 text-lg font-bold">{formatNumber(item.registrations)}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div>
                      <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>Capacity</span>
                        <span>{item.capacity > 0 ? formatPercent(capacityRate) : "Not set"}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(capacityRate, 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Submission coverage</span>
                      <Badge variant={submissionRate >= 70 ? "success" : "outline"}>{formatPercent(submissionRate)}</Badge>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <DashboardEmptyState message="No participant data is available for the selected events." />
      )}
    </DashboardSection>
  );
}
