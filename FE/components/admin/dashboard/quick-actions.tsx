import Link from "next/link";
import { Bell, ClipboardCheck, FileWarning, Plus, Users } from "lucide-react";
import { DashboardSection } from "./dashboard-section";
import type { QuickActionItem } from "@/lib/admin-dashboard/dashboard-types";

const icons = { create: Plus, review: ClipboardCheck, submission: FileWarning, notify: Bell, users: Users };

export function QuickActions({ data }: { data: QuickActionItem[] }) {
  return <DashboardSection title="Quick Actions" description="Common administration tasks">
    <div className="grid gap-2">
      {data.map((item) => {
        const Icon = icons[item.icon];
        return <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] p-3 text-sm font-medium hover:border-orange-500/30 hover:bg-orange-500/[0.04]"><span className="grid size-8 place-items-center rounded-lg bg-orange-500/10 text-orange-400"><Icon className="size-4" /></span>{item.label}</Link>;
      })}
    </div>
  </DashboardSection>;
}
