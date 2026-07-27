import { Badge } from "@/components/ui/badge";
import type { EligibilityStatus } from "@/lib/organizer/registrations/registration-types";
const variants = { Eligible: "success", "Needs Review": "warning", "Not Eligible": "destructive" } as const;
export function EligibilityBadge({ status, reason }: { status: EligibilityStatus; reason?: string }) { return <span title={reason}><Badge variant={variants[status]}>{status}</Badge></span>; }
