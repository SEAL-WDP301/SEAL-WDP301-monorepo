"use client";
import { ManagementError } from "@/components/organizer/shared/management-states";
export default function ErrorPage({ reset }: { reset: () => void }) { return <ManagementError onRetry={reset} />; }
