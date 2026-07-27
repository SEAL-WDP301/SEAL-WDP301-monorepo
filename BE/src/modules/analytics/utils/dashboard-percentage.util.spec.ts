import {
  calculateChange,
  calculatePercentage,
} from "./dashboard-percentage.util";

describe("dashboard percentage utilities", () => {
  it("never returns Infinity or NaN when total is zero", () => {
    expect(calculatePercentage(10, 0)).toBe(0);
    expect(Number.isFinite(calculatePercentage(0, 0))).toBe(true);
  });

  it("handles a zero previous value", () => {
    expect(calculateChange(0, 0)).toMatchObject({
      changePercentage: 0,
      changeDirection: "UNCHANGED",
    });
    expect(calculateChange(5, 0)).toMatchObject({
      changePercentage: 100,
      changeDirection: "INCREASE",
    });
  });
});
