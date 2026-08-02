import { describe, expect, it } from "vitest";
import { calculatePrizePoolTotals } from "./prizes";

describe("calculatePrizePoolTotals", () => {
  it("sums every prize amount multiplied by its quantity", () => {
    expect(
      calculatePrizePoolTotals([
        { amount: 60_000_000, quantity: 1, currency: "VND" },
        { amount: 35_000_000, quantity: 1, currency: "VND" },
        { amount: 10_000_000, quantity: 2, currency: "VND" },
      ]),
    ).toEqual([{ currency: "VND", amount: 115_000_000 }]);
  });

  it("keeps totals for different currencies separate", () => {
    expect(
      calculatePrizePoolTotals([
        { amount: 1_000, quantity: 2, currency: "USD" },
        { amount: 5_000_000, quantity: 1, currency: "VND" },
      ]),
    ).toEqual([
      { currency: "USD", amount: 2_000 },
      { currency: "VND", amount: 5_000_000 },
    ]);
  });
});
