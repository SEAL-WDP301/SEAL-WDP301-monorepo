import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardSection } from "./dashboard-section";
import type { RecentRegistrationItem } from "@/lib/admin-dashboard/dashboard-types";

const variants = { Pending: "warning", Approved: "success", Rejected: "destructive", Waitlisted: "outline" } as const;

export function RecentRegistrations({ data }: { data: RecentRegistrationItem[] }) {
  return <DashboardSection title="Recent Registrations" description="Latest registration activity in the selected period">
    <Table>
      <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Event</TableHead><TableHead>Registered</TableHead><TableHead>Status</TableHead><TableHead>Team</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
      <TableBody>{data.map((item) => <TableRow key={item.id}>
        <TableCell><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-orange-500/10 text-xs font-semibold text-orange-400">{item.initials}</span><span className="font-medium">{item.student}</span></div></TableCell>
        <TableCell className="max-w-64 truncate text-muted-foreground">{item.event}</TableCell>
        <TableCell className="text-muted-foreground">{item.time}</TableCell>
        <TableCell><Badge variant={variants[item.status]}>{item.status}</Badge></TableCell>
        <TableCell className="text-muted-foreground">{item.teamStatus}</TableCell>
        <TableCell className="text-right"><Button asChild variant="ghost" size="sm"><Link href={`/organizer/registrations?registrationId=${encodeURIComponent(item.id)}`}>View details</Link></Button></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </DashboardSection>;
}
