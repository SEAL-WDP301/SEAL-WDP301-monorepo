import type { RegistrationFilters } from "./registration-types";

export const defaultRegistrationFilters: RegistrationFilters = {
  search: "", eventId: "all", status: "All", eligibility: "All", teamStatus: "All",
  season: "All Seasons", year: "All Years", dateRange: "Last 30 days",
  sortBy: "registeredAt", sortOrder: "desc", page: 1, limit: 10,
};

export function parseRegistrationFilters(params: URLSearchParams): RegistrationFilters {
  return {
    ...defaultRegistrationFilters,
    search: params.get("search") ?? "",
    eventId: params.get("eventId") ?? "all",
    status: params.get("status") ?? "All",
    eligibility: params.get("eligibility") ?? "All",
    teamStatus: params.get("teamStatus") ?? "All",
    season: params.get("season") ?? "All Seasons",
    year: params.get("year") ?? "All Years",
    dateRange: params.get("dateRange") ?? "Last 30 days",
    sortBy: params.get("sortBy") ?? "registeredAt",
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(params.get("page")) || 1),
    limit: [10, 20, 50, 100].includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 10,
  };
}
