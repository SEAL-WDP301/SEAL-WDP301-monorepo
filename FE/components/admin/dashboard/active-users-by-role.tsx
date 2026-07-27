import { ProgressBar } from "@tremor/react";
import { DashboardSection } from "./dashboard-section";
import type { ActiveUsersByRoleMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber, formatPercent } from "@/lib/admin-dashboard/dashboard-formatters";

export function ActiveUsersByRole({ data }: { data: ActiveUsersByRoleMetric[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <DashboardSection title="Active Users by Role" description={`${formatNumber(total)} unique active users`}>
    <div className="space-y-5">
      {data.map((item) => <div key={item.role}>
        <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">{item.role}</span><span className="text-muted-foreground">{formatNumber(item.value)} · {formatPercent((item.value / total) * 100)} · <span className={item.delta >= 0 ? "text-emerald-400" : "text-red-400"}>{item.delta >= 0 ? "+" : ""}{item.delta}%</span></span></div>
        <ProgressBar value={(item.value / total) * 100} color="orange" className="h-1.5" />
      </div>)}
    </div>
  </DashboardSection>;
}
