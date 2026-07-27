import type { RegistrationOverview } from "@/lib/organizer/registrations/registration-types";
import { RegistrationMetricCard } from "./registration-metric-card";
export function RegistrationKpiGrid({ overview }: { overview: RegistrationOverview }) { return <section aria-label="Registration metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{overview.metrics.map((metric) => <RegistrationMetricCard key={metric.id} metric={metric} />)}</section>; }
