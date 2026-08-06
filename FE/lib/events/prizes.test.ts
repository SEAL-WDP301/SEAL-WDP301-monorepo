import { describe, expect, it } from "vitest";
import {
  calculatePrizePoolTotals,
  getPrizeAmountOrderViolations,
  getNextPrizePlacement,
  getPrizePlacementLabel,
  normalizePrizeOrder,
  reorderRankedPrizes,
} from "./prizes";

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

describe("getPrizeAmountOrderViolations", () => {
  it("rejects a third prize worth more than the second prize", () => {
    expect(
      getPrizeAmountOrderViolations([
        { placement: 3, amount: 10_000_000 },
        { placement: 2, amount: 5_000_000 },
        { placement: 1, amount: 12_500_000 },
      ]),
    ).toEqual([{ higherIndex: 1, lowerIndex: 0 }]);
  });

  it("allows ranked prizes to have equal amounts", () => {
    expect(
      getPrizeAmountOrderViolations([
        { placement: 1, amount: 10_000_000 },
        { placement: 2, amount: 10_000_000 },
        { placement: 3, amount: 10_000_000 },
      ]),
    ).toEqual([]);
  });

  it("compares the remaining ranked prizes when a placement is missing", () => {
    expect(
      getPrizeAmountOrderViolations([
        { placement: 1, amount: 5_000_000 },
        { placement: 3, amount: 10_000_000 },
      ]),
    ).toEqual([{ higherIndex: 0, lowerIndex: 1 }]);
  });

  it("ignores special prizes", () => {
    expect(
      getPrizeAmountOrderViolations([
        { placement: 1, amount: 5_000_000 },
        { placement: null, amount: 20_000_000 },
      ]),
    ).toEqual([]);
  });

  it("validates placements beyond third prize", () => {
    expect(
      getPrizeAmountOrderViolations([
        { placement: 3, amount: 5_000_000 },
        { placement: 4, amount: 6_000_000 },
        { placement: 5, amount: 1_000_000 },
      ]),
    ).toEqual([{ higherIndex: 0, lowerIndex: 1 }]);
  });
});

describe("dynamic prize placements", () => {
  it("assigns the next placement after the current maximum", () => {
    expect(
      getNextPrizePlacement([
        { placement: 1 },
        { placement: 3 },
        { placement: null },
      ]),
    ).toBe(4);
  });

  it("starts at first placement when only special prizes exist", () => {
    expect(getNextPrizePlacement([{ placement: null }])).toBe(1);
  });

  it("labels placements beyond third prize", () => {
    expect(getPrizePlacementLabel(6)).toBe("Placement 6");
  });

  it("orders ranked prizes by placement and keeps special prizes last", () => {
    expect(
      normalizePrizeOrder([
        { name: "Third", placement: 3, amount: 1_000_000 },
        { name: "Special", placement: null, amount: 20_000_000 },
        { name: "First", placement: 1, amount: 10_000_000 },
      ]),
    ).toEqual([
      { name: "First", placement: 1, amount: 10_000_000 },
      { name: "Third", placement: 2, amount: 1_000_000 },
      { name: "Special", placement: null, amount: 20_000_000 },
    ]);
  });

  it("reassigns placements after dragging a ranked prize", () => {
    expect(
      reorderRankedPrizes(
        [
          { name: "First", placement: 1, amount: 10_000_000 },
          { name: "Second", placement: 2, amount: 5_000_000 },
          { name: "Special", placement: null, amount: 20_000_000 },
        ],
        1,
        0,
      ),
    ).toEqual([
      { name: "Second", placement: 1, amount: 5_000_000 },
      { name: "First", placement: 2, amount: 10_000_000 },
      { name: "Special", placement: null, amount: 20_000_000 },
    ]);
  });

  it("flags an amount increase created by dragging", () => {
    const reorderedPrizes = reorderRankedPrizes(
      [
        { placement: 1, amount: 10_000_000 },
        { placement: 2, amount: 5_000_000 },
      ],
      1,
      0,
    );

    expect(getPrizeAmountOrderViolations(reorderedPrizes)).toEqual([
      { higherIndex: 0, lowerIndex: 1 },
    ]);
  });
});
