import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus } from "@/lib/organizer/registrations/registration-types";
const variants = { Pending: "warning", Approved: "success", Rejected: "destructive", Cancelled: "outline" } as const;
export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) { return <Badge variant={variants[status]}>{status}</Badge>; }
