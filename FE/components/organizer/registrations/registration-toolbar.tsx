"use client";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FILTER_OPTIONS } from "@/lib/organizer/registrations/registration-constants";
import { defaultRegistrationFilters } from "@/lib/organizer/registrations/registration-search-params";
import type { RegistrationFilters } from "@/lib/organizer/registrations/registration-types";

function FilterSelect({ value, options, onChange, label }: { value: string; options: string[] | { value: string; label: string }[]; onChange: (value: string) => void; label: string }) {
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return <Select value={value} onValueChange={(next) => next && onChange(next)}><SelectTrigger aria-label={label} className="h-9 min-w-36 bg-background/40"><SelectValue /></SelectTrigger><SelectContent>{normalized.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
}

export function RegistrationToolbar({ filters, search, onSearchChange, onChange, onReset, onExport, eventOptions = [] }: {
  filters: RegistrationFilters; search: string; onSearchChange: (value: string) => void;
  onChange: (patch: Partial<RegistrationFilters>) => void; onReset: () => void; onExport: () => void;
  eventOptions?: { value: string; label: string }[];
}) {
  const activeCount = (Object.keys(defaultRegistrationFilters) as (keyof RegistrationFilters)[]).filter((key) =>
    !["page", "limit", "sortBy", "sortOrder"].includes(key) && filters[key] !== defaultRegistrationFilters[key],
  ).length;
  return <div className="rounded-2xl border border-border bg-card/60 p-4">
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search name, email, student ID or team..." className="h-9 pl-9" /></div>
        <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Filters</span>{activeCount > 0 && <Badge>{activeCount} active</Badge>}<Button variant="ghost" size="sm" onClick={onReset} disabled={activeCount === 0}><X /> Clear All</Button><Button variant="outline" size="sm" onClick={onExport}>Export filtered</Button></div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterSelect label="Event" value={filters.eventId} options={[{ value: "all", label: "All Events" }, ...eventOptions]} onChange={(eventId) => onChange({ eventId })} />
        <FilterSelect label="Status" value={filters.status} options={FILTER_OPTIONS.status} onChange={(status) => onChange({ status })} />
        <FilterSelect label="Eligibility" value={filters.eligibility} options={FILTER_OPTIONS.eligibility} onChange={(eligibility) => onChange({ eligibility })} />
        <FilterSelect label="Team status" value={filters.teamStatus} options={FILTER_OPTIONS.teamStatus} onChange={(teamStatus) => onChange({ teamStatus })} />
        <FilterSelect label="Season" value={filters.season} options={FILTER_OPTIONS.season} onChange={(season) => onChange({ season })} />
        <FilterSelect label="Year" value={filters.year} options={FILTER_OPTIONS.year} onChange={(year) => onChange({ year })} />
        <FilterSelect label="Date range" value={filters.dateRange} options={FILTER_OPTIONS.dateRange} onChange={(dateRange) => onChange({ dateRange })} />
      </div>
    </div>
  </div>;
}
