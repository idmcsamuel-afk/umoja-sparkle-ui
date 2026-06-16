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

/** Alias for currencySymbol — accepts a currency code (ZAR, NGN, …). */
export function getCurrencySymbol(currencyCode: string): string {
  return currencySymbol(currencyCode);
}

/** Map ISO country code → currency code. Defaults to ZAR. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  ZM: "ZMW",
  MZ: "MZN",
};

export function getCurrencyCode(countryCode: string): string {
  return COUNTRY_TO_CURRENCY[(countryCode || "").toUpperCase()] ?? "ZAR";
}

/** Per-country tier visibility. Fulfilled is South Africa only for now. */
export function getTierVisibility(countryCode: string) {
  const cc = (countryCode || "").toUpperCase();
  return {
    seedVisible: true,
    growthVisible: true,
    harvestVisible: true,
    fulfilledVisible: cc === "ZA",
  };
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
