"use client";

import Link from "next/link";
import { Activity, CalendarDays, ClipboardCheck, FileCheck, Radio, Users } from "lucide-react";
import { SparkAreaChart } from "@tremor/react";
import { Card } from "@/components/ui/card";
import type { MetricCardData } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber } from "@/lib/admin-dashboard/dashboard-formatters";
import { cn } from "@/lib/utils";

const icons = { events: CalendarDays, active: Radio, registrations: ClipboardCheck, participants: Users, submissions: FileCheck, users: Activity };

export function MetricCard({ metric, wide = false }: { metric: MetricCardData; wide?: boolean }) {
  const Icon = icons[metric.icon];
  const sparkData = metric.sparkline.map((value, index) => ({ index, value }));
  return (
    <Link href={metric.href} className={wide ? "xl:col-span-2" : ""}>
      <Card className="h-full p-5 hover:-translate-y-0.5 hover:border-orange-500/30">
        <div className="flex items-start justify-between">
          <div className="grid size-10 place-items-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-[#ff8a3d]"><Icon className="size-5" /></div>
          <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", metric.delta >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-red-500/20 bg-red-500/10 text-red-400")}>
            {metric.delta >= 0 ? "+" : ""}{metric.delta}%
          </span>
        </div>
        <div className={cn("mt-5 grid items-end gap-3", sparkData.length > 0 && "grid-cols-[1fr_110px]")}>
          <div>
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{formatNumber(metric.value)}</p>
          </div>
          {sparkData.length > 0 ? (
            <SparkAreaChart data={sparkData} index="index" categories={["value"]} colors={["orange"]} className="h-12" />
          ) : null}
        </div>
        <p className="mt-4 text-xs font-medium text-foreground/80">{metric.detail}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{metric.comparison}</p>
      </Card>
    </Link>
  );
}
