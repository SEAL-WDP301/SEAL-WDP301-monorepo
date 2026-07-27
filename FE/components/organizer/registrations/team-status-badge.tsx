import { Badge } from "@/components/ui/badge";
import type { RegistrationTeamStatus } from "@/lib/organizer/registrations/registration-types";
const variants = { "No Team": "outline", "Has Team": "success", "Team Full": "warning", "Team Disbanded": "destructive" } as const;
export function TeamStatusBadge({ status }: { status: RegistrationTeamStatus }) { return <Badge variant={variants[status]}>{status}</Badge>; }
