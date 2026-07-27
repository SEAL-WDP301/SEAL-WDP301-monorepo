"use client";
import { AreaChart } from "@tremor/react";
import { DashboardSection } from "./dashboard-section";
import type { RegistrationTrendMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber } from "@/lib/admin-dashboard/dashboard-formatters";

export function RegistrationParticipationChart({ data }: { data: RegistrationTrendMetric[] }) {
  return <DashboardSection title="Registration & Participation Trend" description="Registrations are up 14.8% from the previous period">
    <AreaChart data={data} index="date" categories={["Registrations", "Participants"]} colors={["orange", "emerald"]} valueFormatter={formatNumber} className="h-72" showLegend showAnimation={false} />
  </DashboardSection>;
}
