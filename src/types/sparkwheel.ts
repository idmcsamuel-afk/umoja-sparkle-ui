// Sparkwheel — shared TypeScript types.
// Mirrors the sparkwheel_games table and the spin_sparkwheel RPC contract.

export type SparkBucket = "promotional" | "earned" | "purchased" | "referral";
export type SparkwheelMultiplier = 0 | 1.2 | 1.5 | 2 | 5 | 10;

export interface BucketBalances {
  promotional: number;
  earned: number;
  purchased: number;
  referral: number;
}

export interface SparkwheelGame {
  id: string;
  member_id: string;
  bucket_used: SparkBucket;
  stake_amount: number;
  outcome_multiplier: SparkwheelMultiplier;
  payout_amount: number;
  house_edge: number;
  daily_game_count: number;
  timestamp: string;
}

export interface SpinSparkwheelParams {
  p_member_id: string;
  p_bucket: SparkBucket;
  p_stake_amount: number;
}

export interface SpinSparkwheelResult {
  outcome_multiplier: SparkwheelMultiplier;
  payout_amount: number;
  won: boolean;
  house_edge: number;
  daily_game_count: number;
  daily_remaining: number;
  balances: BucketBalances;
}

export interface WheelSegment {
  multiplier: SparkwheelMultiplier;
  label: string;
  weightNormal: number;
  weightPromo: number;
  color: string;
}

export interface BucketMeta {
  key: SparkBucket;
  label: string;
  emoji: string;
  withdrawable: string;
}
