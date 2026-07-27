"use client";
import { AreaChart } from "@tremor/react";
import { DashboardSection } from "./dashboard-section";
import type { ActiveUsersHourlyMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber } from "@/lib/admin-dashboard/dashboard-formatters";

export function ActiveUsersChart({ data }: { data: ActiveUsersHourlyMetric[] }) {
  const peak = data.reduce((highest, item) => item.Users > highest.Users ? item : highest, data[0]);
  const average = Math.round(data.reduce((sum, item) => sum + item.Users, 0) / data.length);
  return <DashboardSection title="Active Users by Hour" description={`Peak ${peak.hour} (${peak.Users} users) · ${average} average · 3.2% below previous 24h`}>
    <AreaChart data={data} index="hour" categories={["Users"]} colors={["orange"]} valueFormatter={formatNumber} className="h-72" showAnimation={false} />
  </DashboardSection>;
}
