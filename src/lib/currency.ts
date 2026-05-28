// Exchange rates from ZAR. Updated monthly. Last update: May 28, 2026.
// Next scheduled update: June 28, 2026.
export const exchangeRates: Record<string, number> = {
  ZAR: 1,
  NGN: 85,
  KES: 7.93,
  ZMW: 1.15,
  MZN: 3.91,
  // ZWL removed — Zimbabwe hidden (hyperinflated)
};

export const currencySymbols: Record<string, string> = {
  ZAR: "R",
  NGN: "₦",
  KES: "KES ",
  ZMW: "ZMW ",
  MZN: "MZN ",
};

export const basePricesZAR = {
  buyers_club: 499,
  storefront: 999,
  fulfilled: 1999,
} as const;

export type TierName = keyof typeof basePricesZAR;

export function calculateTierPrice(tier: TierName, currencyCode: string): number | null {
  const base = basePricesZAR[tier];
  const rate = exchangeRates[currencyCode];
  if (base == null || rate == null) return null;
  return Math.round(base * rate);
}

export function currencySymbol(currencyCode: string): string {
  return currencySymbols[currencyCode] ?? "";
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = currencySymbol(currencyCode);
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

export function formatTierPrice(tier: TierName, currencyCode: string): string | null {
  const price = calculateTierPrice(tier, currencyCode);
  if (price == null) return null;
  return `${formatCurrency(price, currencyCode)}/month`;
}
