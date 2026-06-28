
DROP VIEW IF EXISTS public.v_valid_circle_bids;
ALTER TABLE public.circle_bids DROP COLUMN IF EXISTS is_valid_contribution;

ALTER TABLE public.circle_bids
  ADD COLUMN is_valid_contribution boolean
  GENERATED ALWAYS AS (
    quarantined_at IS NULL
    AND COALESCE(status, '') NOT IN ('rejected', 'expired')
    AND (
      payment_status = 'success'
      OR payment_confirmed_at IS NOT NULL
      OR (payment_method = 'eft'  AND payment_proof_url IS NOT NULL AND payment_confirmed_at IS NOT NULL)
      OR (payment_method = 'usdt' AND payment_crypto_txhash IS NOT NULL)
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_circle_bids_valid_contrib
  ON public.circle_bids (member_id)
  WHERE is_valid_contribution = true;

CREATE VIEW public.v_valid_circle_bids
  WITH (security_invoker = true)
  AS
  SELECT * FROM public.circle_bids
  WHERE is_valid_contribution = true;

GRANT SELECT ON public.v_valid_circle_bids TO authenticated, service_role;
