"use client";
import { RegistrationErrorState } from "@/components/organizer/registrations/registration-error-state";
export default function ErrorPage({ reset }: { reset: () => void }) { return <RegistrationErrorState onRetry={reset} />; }
