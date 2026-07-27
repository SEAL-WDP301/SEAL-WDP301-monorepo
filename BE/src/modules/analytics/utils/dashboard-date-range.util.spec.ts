import { BadRequestException } from "@nestjs/common";
import { DashboardGroupBy } from "../dto/organizer-dashboard-query.dto";
import { resolveDateRange, resolveGroupBy } from "./dashboard-date-range.util";

describe("dashboard date range utilities", () => {
  it("creates a previous period with the same duration", () => {
    const range = resolveDateRange({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T00:00:00.000Z",
    });
    expect(range.to.getTime() - range.from.getTime()).toBe(
      range.previousTo.getTime() - range.previousFrom.getTime(),
    );
  });

  it("rejects reversed and excessive ranges", () => {
    expect(() =>
      resolveDateRange({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-07-01T00:00:00.000Z",
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveDateRange({
        from: "2024-01-01T00:00:00.000Z",
        to: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(BadRequestException);
  });

  it("uses a requested group and otherwise selects a suitable default", () => {
    const range = resolveDateRange({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-02T00:00:00.000Z",
    });
    expect(resolveGroupBy(range)).toBe(DashboardGroupBy.HOUR);
    expect(resolveGroupBy(range, DashboardGroupBy.MONTH)).toBe(
      DashboardGroupBy.MONTH,
    );
  });
});
