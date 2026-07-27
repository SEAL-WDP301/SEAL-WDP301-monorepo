export function roundPercentage(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculatePercentage(value: number, total: number): number {
  return total > 0 ? roundPercentage((value / total) * 100) : 0;
}

export function calculateChange(current: number, previous: number) {
  const changePercentage =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : roundPercentage(((current - previous) / previous) * 100);
  return {
    previousValue: previous,
    changePercentage,
    changeDirection:
      current > previous
        ? ("INCREASE" as const)
        : current < previous
          ? ("DECREASE" as const)
          : ("UNCHANGED" as const),
  };
}
