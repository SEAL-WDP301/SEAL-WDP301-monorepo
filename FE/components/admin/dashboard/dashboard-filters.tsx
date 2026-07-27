"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardFilters as Filters, DateRange, Season } from "@/lib/admin-dashboard/dashboard-types";

function FilterSelect({
  label, value, options, onChange, className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
        <SelectTrigger className={className ?? "h-9 w-full min-w-36 bg-background/40"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}

export function DashboardFilters({
  filters, onChange, onRefresh, refreshing, lastUpdated, eventOptions = [], seasonOptions = [], yearOptions = [],
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onRefresh: () => void;
  refreshing: boolean;
  lastUpdated: string;
  eventOptions?: { value: string; label: string }[];
  seasonOptions?: string[];
  yearOptions?: number[];
}) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur-xl">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.3fr_1fr_.8fr_auto] xl:items-end">
        <FilterSelect label="Date range" value={filters.range} onChange={(range) => onChange({ ...filters, range: range as DateRange })} options={[
          { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" },
          { value: "90d", label: "Last 90 days" }, { value: "year", label: "This year" },
        ]} />
        <FilterSelect label="Event" value={filters.eventId} onChange={(eventId) => onChange({ ...filters, eventId })} options={[{ value: "all", label: "All Events" }, ...eventOptions]} />
        <FilterSelect label="Season" value={filters.season} onChange={(season) => onChange({ ...filters, season: season as Season })} options={[
          { value: "all", label: "All Seasons" }, { value: "spring", label: "Spring" },
          ...seasonOptions.filter((season) => !["all", "spring"].includes(season.toLowerCase())).map((season) => ({ value: season.toLowerCase(), label: season })),
        ]} />
        <FilterSelect label="Year" value={String(filters.year)} onChange={(year) => onChange({ ...filters, year: Number(year) })} options={(yearOptions.length ? yearOptions : [currentYear]).map((year) => ({ value: String(year), label: String(year) }))} />
        <div className="flex items-center justify-between gap-4 sm:col-span-2 xl:col-span-1 xl:block">
          <Button variant="outline" className="h-9" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
          <p className="text-[11px] text-muted-foreground xl:mt-2 xl:text-right">Updated {lastUpdated}</p>
        </div>
      </div>
    </div>
  );
}
