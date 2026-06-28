
-- Validity guard for circle_bids: only count a bid as a real contribution / payout
-- candidate when (a) not quarantined, (b) status not in rejected/expired, and
-- (c) payment is confirmed via one of the three legitimate channels.
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS is_valid_contribution boolean
  GENERATED ALWAYS AS (
    quarantined_at IS NULL
    AND COALESCE(status, '') NOT IN ('rejected', 'expired')
    AND (
      payment_status = 'success'
      OR (payment_method = 'eft'  AND payment_proof_url IS NOT NULL AND payment_confirmed_at IS NOT NULL)
      OR (payment_method = 'usdt' AND payment_crypto_txhash IS NOT NULL)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_circle_bids_valid_contrib
  ON public.circle_bids (member_id)
  WHERE is_valid_contribution = true;

-- Convenience view for server-side joins / RPCs.
CREATE OR REPLACE VIEW public.v_valid_circle_bids
  WITH (security_invoker = true)
  AS
  SELECT * FROM public.circle_bids
  WHERE is_valid_contribution = true;

GRANT SELECT ON public.v_valid_circle_bids TO authenticated, service_role;
