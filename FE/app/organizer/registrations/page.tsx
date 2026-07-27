import { Suspense } from "react";
import { RegistrationsClient } from "@/components/organizer/registrations/registrations-client";
import { RegistrationTableSkeleton } from "@/components/organizer/registrations/registration-table-skeleton";
export default function OrganizerRegistrationsPage() { return <Suspense fallback={<RegistrationTableSkeleton />}><RegistrationsClient /></Suspense>; }
