import { BadRequestException } from "@nestjs/common";
import {
  DashboardGroupBy,
  OrganizerDashboardQueryDto,
} from "../dto/organizer-dashboard-query.dto";

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export interface ResolvedDateRange {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

export function resolveDateRange(
  query: OrganizerDashboardQueryDto,
): ResolvedDateRange {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from > to || to.getTime() - from.getTime() > MAX_RANGE_MS) {
    throw new BadRequestException({
      errorCode: "INVALID_DATE_RANGE",
      message: "Date range must be valid and no longer than 366 days",
    });
  }
  const duration = to.getTime() - from.getTime();
  return {
    from,
    to,
    previousFrom: new Date(from.getTime() - duration),
    previousTo: new Date(from.getTime()),
  };
}

export function resolveGroupBy(
  range: ResolvedDateRange,
  requested?: DashboardGroupBy,
): DashboardGroupBy {
  if (requested) return requested;
  const hours = (range.to.getTime() - range.from.getTime()) / 3_600_000;
  if (hours <= 48) return DashboardGroupBy.HOUR;
  if (hours <= 45 * 24) return DashboardGroupBy.DAY;
  if (hours <= 180 * 24) return DashboardGroupBy.WEEK;
  return DashboardGroupBy.MONTH;
}

export function periodKey(date: Date, groupBy: DashboardGroupBy): string {
  const iso = date.toISOString();
  if (groupBy === DashboardGroupBy.HOUR)
    return iso.slice(0, 13) + ":00:00.000Z";
  if (groupBy === DashboardGroupBy.DAY) return iso.slice(0, 10);
  if (groupBy === DashboardGroupBy.MONTH) return iso.slice(0, 7);
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}
