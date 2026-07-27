"use client";
import { DashboardErrorState } from "@/components/admin/dashboard/dashboard-error-state";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <DashboardErrorState onRetry={reset} />;
}
