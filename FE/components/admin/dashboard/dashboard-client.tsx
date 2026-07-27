"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DashboardFilters } from "./dashboard-filters";
import { MetricCard } from "./metric-card";
import { MetricCardSkeleton } from "./metric-card-skeleton";
import { EventsByMonthChart } from "./events-by-month-chart";
import { EventStatusChart } from "./event-status-chart";
import { RegistrationParticipationChart } from "./registration-participation-chart";
import { ParticipationConversion } from "./participation-conversion";
import { DashboardErrorState } from "./dashboard-error-state";
import type { AdminDashboardData, DashboardFilters as Filters, DateRange, Season } from "@/lib/admin-dashboard/dashboard-types";
import { adminDashboardService } from "@/services/admin-dashboard.service";

const ParticipantsByEventChart = dynamic(() => import("./participants-by-event-chart").then((module) => module.ParticipantsByEventChart), { ssr: false });
const SubmissionStatusChart = dynamic(() => import("./submission-status-chart").then((module) => module.SubmissionStatusChart), { ssr: false });
const SubmissionActivityChart = dynamic(() => import("./submission-activity-chart").then((module) => module.SubmissionActivityChart), { ssr: false });
const UpcomingDeadlines = dynamic(() => import("./upcoming-deadlines").then((module) => module.UpcomingDeadlines), { ssr: false });
const QuickActions = dynamic(() => import("./quick-actions").then((module) => module.QuickActions), { ssr: false });
const RecentRegistrations = dynamic(() => import("./recent-registrations").then((module) => module.RecentRegistrations), { ssr: false });

function getFilters(searchParams: URLSearchParams): Filters {
  const currentYear = new Date().getFullYear();
  const range = searchParams.get("range");
  const season = searchParams.get("season");
  return {
    range: range === "7d" || range === "90d" || range === "year" ? range as DateRange : "30d",
    eventId: searchParams.get("eventId") ?? "all",
    season: season === "spring" || season === "summer" || season === "fall" ? season as Season : "all",
    year: Number(searchParams.get("year")) || currentYear,
  };
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => getFilters(searchParams));
  const filterOptionsQuery = useQuery({
    queryKey: ["organizer-dashboard-filter-options"],
    queryFn: adminDashboardService.getFilterOptions,
    staleTime: 5 * 60 * 1000,
  });
  const dashboardQuery = useQuery({
    queryKey: ["organizer-dashboard", filters],
    queryFn: () => adminDashboardService.getDashboard(filters, filterOptionsQuery.data),
    enabled: filterOptionsQuery.isSuccess,
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
  });
  const data: AdminDashboardData | undefined = dashboardQuery.data;
  const filterOptions = filterOptionsQuery.data ?? { events: [], seasons: [], years: [] };
  const loading = dashboardQuery.isPending;
  const refreshing = dashboardQuery.isFetching && !dashboardQuery.isPending;
  const failed = filterOptionsQuery.isError || dashboardQuery.isError;
  const lastUpdated = dashboardQuery.dataUpdatedAt
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(dashboardQuery.dataUpdatedAt)
    : "just now";

  const changeFilters = (nextFilters: Filters) => {
    setFilters(nextFilters);
    const params = new URLSearchParams();
    params.set("range", nextFilters.range);
    params.set("eventId", nextFilters.eventId);
    params.set("season", nextFilters.season);
    params.set("year", String(nextFilters.year));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">System overview</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Organizer Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Monitor events, participation, and submissions across SEAL.</p>
      </div>
      <DashboardFilters filters={filters} onChange={changeFilters} onRefresh={() => void dashboardQuery.refetch()} refreshing={refreshing} lastUpdated={lastUpdated} eventOptions={filterOptions.events} seasonOptions={filterOptions.seasons} yearOptions={filterOptions.years} />
      {failed ? <DashboardErrorState onRetry={() => { void filterOptionsQuery.refetch(); void dashboardQuery.refetch(); }} /> : (
        <>
          <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading || !data ? Array.from({ length: 5 }, (_, index) => <MetricCardSkeleton key={index} />) : data.overview.metrics.map((metric, index) => <MetricCard key={metric.id} metric={metric} wide={index >= 4} />)}
          </section>
          {data && <>
            <section className="grid gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><EventsByMonthChart data={data.eventsByMonth} /></div><EventStatusChart data={data.eventStatus} /></section>
            <section className="grid gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><RegistrationParticipationChart data={data.registrationTrend} /></div><ParticipationConversion data={data.conversion} /></section>
            <ParticipantsByEventChart data={data.participantsByEvent} />
            <section className="grid gap-6 xl:grid-cols-2"><SubmissionStatusChart data={data.submissionStatus} summary={data.submissionSummary} /><SubmissionActivityChart data={data.submissionActivity} summary={data.submissionSummary} /></section>
            <section className="grid gap-6 xl:grid-cols-3"><div className="xl:col-span-2"><UpcomingDeadlines data={data.deadlines} /></div><QuickActions data={data.quickActions} /></section>
            <RecentRegistrations data={data.recentRegistrations} />
          </>}
        </>
      )}
    </div>
  );
}
