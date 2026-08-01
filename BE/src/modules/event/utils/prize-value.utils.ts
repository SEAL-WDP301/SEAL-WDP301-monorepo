export interface PrizeValueInput {
  amount?: number | null;
  quantity?: number | null;
  currency?: string | null;
}

export interface PrizePoolTotal {
  currency: string;
  amount: number;
}

export function calculatePrizePoolTotals(
  prizes: readonly PrizeValueInput[] = [],
): PrizePoolTotal[] {
  const totals = new Map<string, number>();

  for (const prize of prizes) {
    const currency = prize.currency?.trim().toUpperCase() || "VND";
    const amount = prize.amount ?? 0;
    const quantity = prize.quantity ?? 1;
    totals.set(currency, (totals.get(currency) ?? 0) + amount * quantity);
  }

  return Array.from(totals, ([currency, amount]) => ({
    currency,
    amount,
  })).sort((a, b) => a.currency.localeCompare(b.currency));
}
