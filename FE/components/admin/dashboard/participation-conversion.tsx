import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ProgressBar } from "@tremor/react";
import { DashboardSection } from "./dashboard-section";
import type { ParticipationConversionMetric } from "@/lib/admin-dashboard/dashboard-types";
import { formatNumber, formatPercent } from "@/lib/admin-dashboard/dashboard-formatters";

export function ParticipationConversion({ data }: { data: ParticipationConversionMetric[] }) {
  const largestDrop = data.slice(1).reduce((lowest, item) => item.previousRate < lowest.previousRate ? item : lowest, data[1]);
  return <DashboardSection title="Participation Conversion" description="Progress from registration to evaluation">
    <div className="space-y-4">
      {data.map((item) => {
        const warning = item.stage === largestDrop.stage;
        const previousItem = data[data.indexOf(item) - 1];
        const dropped = previousItem
          ? Math.max(previousItem.value - item.value, 0)
          : 0;
        const inconsistent = previousItem && item.value > previousItem.value;
        return <div key={item.stage} className={warning ? "rounded-xl border border-amber-500/20 bg-amber-500/5 p-3" : ""}>
          <div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 font-medium">{warning && <AlertTriangle className="size-3.5 text-amber-400" />}{item.stage}</span><span>{formatNumber(item.value)} · {formatPercent(item.rate)}</span></div>
          <ProgressBar value={Math.min(item.rate, 100)} color={warning ? "amber" : "orange"} className="h-1.5" />
          {item.stage !== "Registrations" && <p className="mt-1.5 text-[10px] text-muted-foreground">{inconsistent ? "Data exceeds the previous step; check API aggregation" : <>{formatPercent(item.previousRate)} from previous step · {formatNumber(dropped)} dropped</>}</p>}
        </div>;
      })}
    </div>
    <div className="mt-5 flex gap-4 text-xs font-semibold text-orange-400"><Link href="/organizer/registrations">Registrations</Link><Link href="/organizer/submissions">Submissions</Link></div>
  </DashboardSection>;
}
