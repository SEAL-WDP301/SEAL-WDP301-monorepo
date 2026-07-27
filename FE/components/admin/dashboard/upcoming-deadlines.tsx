import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "./dashboard-section";
import type { UpcomingDeadlineItem } from "@/lib/admin-dashboard/dashboard-types";
import { formatDate } from "@/lib/admin-dashboard/dashboard-formatters";

const variants = { Upcoming: "outline", Urgent: "warning", Overdue: "destructive", Completed: "success" } as const;

export function UpcomingDeadlines({ data }: { data: UpcomingDeadlineItem[] }) {
  return <DashboardSection title="Upcoming Events & Deadlines" description="Time-sensitive milestones that need attention">
    <div className="divide-y divide-border">
      {data.map((item) => <div key={item.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="grid size-9 place-items-center rounded-xl bg-orange-500/10 text-orange-400"><CalendarClock className="size-4" /></div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{item.event}</p><Badge variant={variants[item.status]}>{item.status}</Badge>{item.submissionRate && item.submissionRate < 70 ? <Badge variant="warning">{item.submissionRate}% submitted</Badge> : null}</div>
          <p className="mt-1 text-xs text-muted-foreground">{item.type} · {formatDate(item.date)} · {item.remaining}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/organizer/events">Open Event</Link></Button>
        </div>
      </div>)}
    </div>
  </DashboardSection>;
}
