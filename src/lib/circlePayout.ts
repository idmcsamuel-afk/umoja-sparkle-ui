// Model C payout calculation.
// Fees (5% total: 2% platform + 3% Ubuntu fund) are deducted from the GROSS payout,
// NOT from the contribution. User always nets the advertised return.
//
// seed:    1.2x gross  → 1.14x net (+14%)
// growth:  1.3x gross  → 1.235x net (+23.5%)
// harvest: 1.5x gross  → 1.425x net (+42.5%)

export type CircleTier = "seed" | "growth" | "harvest";

export const TIER_GROSS_MULTIPLIER: Record<CircleTier, number> = {
  seed: 1.2,
  growth: 1.3,
  harvest: 1.5,
};

export const FEE_RATE = 0.05;
export const PLATFORM_FEE_RATE = 0.02;
export const UBUNTU_FUND_RATE = 0.03;

export interface PayoutBreakdown {
  gross: number;
  fees: number;
  platformFee: number;
  ubuntuFund: number;
  net: number;
  profit: number;
  netPct: number;
}

export function multiplierForTier(tier: string): number {
  return TIER_GROSS_MULTIPLIER[tier as CircleTier] ?? 1.2;
}

export function computePayout(
  contribution: number,
  tier: string | number,
): PayoutBreakdown {
  // Accept either a tier name or a raw gross-rate (e.g. 0.2 / 0.3 / 0.5)
  const multiplier =
    typeof tier === "number"
      ? 1 + tier
      : multiplierForTier(tier);
  const gross = contribution * multiplier;
  const platformFee = +(gross * PLATFORM_FEE_RATE).toFixed(2);
  const ubuntuFund = +(gross * UBUNTU_FUND_RATE).toFixed(2);
  const fees = +(platformFee + ubuntuFund).toFixed(2);
  const net = +(gross - fees).toFixed(2);
  const profit = +(net - contribution).toFixed(2);
  const netPct = contribution > 0 ? (profit / contribution) * 100 : 0;
  return { gross: +gross.toFixed(2), fees, platformFee, ubuntuFund, net, profit, netPct };
}

/** Resolve the correct payout amount for a bid row, preferring the stored value. */
export function resolvePayoutZar(
  fiatAmount: number,
  tier: string,
  stored?: number | null,
): number {
  if (stored != null && Number(stored) > 0) return Number(stored);
  return computePayout(Number(fiatAmount) || 0, tier).net;
}
