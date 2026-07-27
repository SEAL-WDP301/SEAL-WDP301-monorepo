import { MetricCardSkeleton } from "@/components/admin/dashboard/metric-card-skeleton";

export default function Loading() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <MetricCardSkeleton key={index} />)}</div>;
}
