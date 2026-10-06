CREATE OR REPLACE FUNCTION public.expire_unpaid_bids()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM set_config('app.allow_bid_write', 'on', true);

  WITH upd AS (
    UPDATE public.circle_bids
       SET status = 'expired'
     WHERE status IN ('pending', 'payment_pending')
       AND payment_deadline IS NOT NULL
       AND payment_deadline < now()
       AND (payment_proof_url IS NULL OR length(payment_proof_url) = 0)
       AND payment_submitted_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO n FROM upd;

  PERFORM set_config('app.allow_bid_write', 'off', true);
  RETURN n;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.allow_bid_write', 'off', true);
    RAISE;
END;
$$;