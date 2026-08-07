export interface PrizeValue {
  amount?: number | null;
  quantity?: number | null;
  currency?: string | null;
}

export interface PrizePoolTotal {
  currency: string;
  amount: number;
}

export interface RankedPrizeAmount {
  placement?: number | null;
  amount?: number | null;
}

export interface PrizeAmountOrderViolation {
  higherIndex: number;
  lowerIndex: number;
}

function isRankedPrizePlacement(
  placement?: number | null,
): placement is number {
  return Number.isInteger(placement) && (placement ?? 0) >= 1;
}

function withPrizePlacement<T extends RankedPrizeAmount>(
  prize: T,
  placement: number | null,
): T & { placement: number | null } {
  return { ...prize, placement };
}

export function formatPrizeAmount(amount = 0, currency = "VND") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculatePrizePoolTotals(
  prizes: readonly PrizeValue[] = [],
): PrizePoolTotal[] {
  const totals = new Map<string, number>();

  prizes.forEach((prize) => {
    const currency = prize.currency?.trim().toUpperCase() || "VND";
    const amount = prize.amount ?? 0;
    const quantity = prize.quantity ?? 1;
    totals.set(currency, (totals.get(currency) ?? 0) + amount * quantity);
  });

  return Array.from(totals, ([currency, amount]) => ({
    currency,
    amount,
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function getPrizePlacementLabel(placement?: number | null) {
  if (placement == null) return "Special Prize";
  if (placement === 1) return "First Prize";
  if (placement === 2) return "Second Prize";
  if (placement === 3) return "Third Prize";
  return `Placement ${placement}`;
}

export function getNextPrizePlacement(
  prizes: readonly RankedPrizeAmount[] = [],
) {
  const highestPlacement = prizes.reduce(
    (highest, prize) =>
      isRankedPrizePlacement(prize.placement)
        ? Math.max(highest, prize.placement)
        : highest,
    0,
  );

  return highestPlacement + 1;
}

export function normalizePrizeOrder<T extends RankedPrizeAmount>(
  prizes: readonly T[] = [],
): T[] {
  const rankedPrizes = prizes
    .filter((prize) => isRankedPrizePlacement(prize.placement))
    .sort(
      (first, second) =>
        (first.placement ?? 0) - (second.placement ?? 0),
    );
  const specialPrizes = prizes.filter(
    (prize) => !isRankedPrizePlacement(prize.placement),
  );

  return [
    ...rankedPrizes.map((prize, index) =>
      withPrizePlacement(prize, index + 1),
    ),
    ...specialPrizes.map((prize) => withPrizePlacement(prize, null)),
  ];
}

export function reorderRankedPrizes<T extends RankedPrizeAmount>(
  prizes: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  const normalizedPrizes = normalizePrizeOrder(prizes);
  const rankedPrizes = normalizedPrizes.filter((prize) =>
    isRankedPrizePlacement(prize.placement),
  );
  const specialPrizes = normalizedPrizes.filter(
    (prize) => !isRankedPrizePlacement(prize.placement),
  );

  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= rankedPrizes.length ||
    toIndex >= rankedPrizes.length
  ) {
    return normalizedPrizes;
  }

  const [movedPrize] = rankedPrizes.splice(fromIndex, 1);
  rankedPrizes.splice(toIndex, 0, movedPrize);

  return [
    ...rankedPrizes.map((prize, index) =>
      withPrizePlacement(prize, index + 1),
    ),
    ...specialPrizes.map((prize) => withPrizePlacement(prize, null)),
  ];
}

export function getPrizeAmountOrderViolations(
  prizes: readonly RankedPrizeAmount[],
): PrizeAmountOrderViolation[] {
  const rankedPrizes = prizes
    .map((prize, index) => ({ prize, index }))
    .filter(({ prize }) => isRankedPrizePlacement(prize.placement))
    .sort(
      (first, second) =>
        (first.prize.placement ?? 0) - (second.prize.placement ?? 0),
    );

  const violations: PrizeAmountOrderViolation[] = [];
  for (let index = 1; index < rankedPrizes.length; index += 1) {
    const higher = rankedPrizes[index - 1];
    const lower = rankedPrizes[index];
    if (higher.prize.placement === lower.prize.placement) continue;
    if ((higher.prize.amount ?? 0) < (lower.prize.amount ?? 0)) {
      violations.push({
        higherIndex: higher.index,
        lowerIndex: lower.index,
      });
    }
  }

  return violations;
}
