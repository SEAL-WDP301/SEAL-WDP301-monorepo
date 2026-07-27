import { CheckCircle2, Clock3, Gauge, ListChecks, UserMinus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RegistrationMetric } from "@/lib/organizer/registrations/registration-types";
import { formatRegistrationNumber } from "@/lib/organizer/registrations/registration-formatters";
import { cn } from "@/lib/utils";
const icons = { total: ListChecks, pending: Clock3, approved: CheckCircle2, rejected: UserMinus, rate: Gauge };
export function RegistrationMetricCard({ metric }: { metric: RegistrationMetric }) {
  const Icon = icons[metric.icon];
  return <Card className="gap-0 p-4">
    <div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-xl bg-orange-500/10 text-orange-400"><Icon className="size-4" /></span><span className={cn("text-xs font-semibold", metric.delta >= 0 ? "text-emerald-400" : "text-red-400")}>{metric.delta >= 0 ? "+" : ""}{metric.delta}%</span></div>
    <p className="mt-4 text-xs text-muted-foreground">{metric.label}</p>
    <p className="mt-1 text-2xl font-bold">{formatRegistrationNumber(metric.value)}{metric.suffix}</p>
    <p className="mt-2 text-[11px] text-muted-foreground">{metric.detail}</p>
  </Card>;
}
