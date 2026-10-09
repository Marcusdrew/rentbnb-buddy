export function formatUSD(value: number): string {
  return (
    new Intl.NumberFormat("fr-CD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value) + " $"
  );
}

export function formatFC(value: number): string {
  return (
    new Intl.NumberFormat("fr-CD", { maximumFractionDigits: 0 }).format(value) +
    " FC"
  );
}

export function usdToFc(usd: number, rate: number): number {
  return usd * rate;
}

export function fcToUsd(fc: number, rate: number): number {
  return rate > 0 ? fc / rate : 0;
}
