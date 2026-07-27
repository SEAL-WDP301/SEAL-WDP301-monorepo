import { DashboardGroupBy } from "../dto/organizer-dashboard-query.dto";
import { periodKey, ResolvedDateRange } from "./dashboard-date-range.util";

export function fillMissingPeriods<T extends Record<string, number>>(
  range: ResolvedDateRange,
  groupBy: DashboardGroupBy,
  rows: Array<{ period: string } & T>,
  empty: T,
): Array<{ period: string } & T> {
  const existing = new Map(rows.map((row) => [row.period, row]));
  const result: Array<{ period: string } & T> = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    const key = periodKey(cursor, groupBy);
    if (!result.some((row) => row.period === key)) {
      result.push(existing.get(key) ?? { period: key, ...empty });
    }
    if (groupBy === DashboardGroupBy.HOUR)
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    else if (groupBy === DashboardGroupBy.DAY)
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (groupBy === DashboardGroupBy.WEEK)
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}
