-- Backfill payout_amount with Model C calculation (gross multiplier - 5% fees)
-- so existing bids show the correct payout (user always nets the advertised return).
UPDATE public.circle_bids
SET payout_amount = ROUND((fiat_amount * CASE tier
    WHEN 'seed'    THEN 1.2
    WHEN 'growth'  THEN 1.3
    WHEN 'harvest' THEN 1.5
    ELSE 1.2
  END) * 0.95, 2)
WHERE payout_amount IS NULL
   OR payout_amount < fiat_amount;  -- previously stored as fiat * 0.95 (loss)