import { Suspense } from "react";
import { DashboardClient } from "@/components/admin/dashboard/dashboard-client";
import { MetricCardSkeleton } from "@/components/admin/dashboard/metric-card-skeleton";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <MetricCardSkeleton key={index} />)}</div>}>
      <DashboardClient />
    </Suspense>
  );
}
