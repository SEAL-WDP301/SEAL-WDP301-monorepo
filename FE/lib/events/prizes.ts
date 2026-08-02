export interface PrizeValue {
  amount?: number | null;
  quantity?: number | null;
  currency?: string | null;
}

export interface PrizePoolTotal {
  currency: string;
  amount: number;
}

export function formatPrizeAmount(amount = 0, currency = "VND") {
  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
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
  if (placement === 1) return "First Prize";
  if (placement === 2) return "Second Prize";
  if (placement === 3) return "Third Prize";
  return "Special Prize";
}
