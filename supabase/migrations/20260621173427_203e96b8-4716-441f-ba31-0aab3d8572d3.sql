
-- 1) Fix the auto-expire function: never expire bids with proof uploaded
CREATE OR REPLACE FUNCTION public.expire_unpaid_bids()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.circle_bids
       SET status = 'expired'
     WHERE status IN ('pending','payment_pending')
       AND payment_deadline IS NOT NULL
       AND payment_deadline < now()
       AND (payment_proof_url IS NULL OR length(payment_proof_url) = 0)
       AND payment_submitted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO n FROM upd;
  RETURN n;
END $$;

-- 2) Restore bids that were wrongly expired despite having proof attached
UPDATE public.circle_bids
   SET status = 'payment_pending',
       payment_deadline = GREATEST(payment_deadline, now() + interval '7 days')
 WHERE status = 'expired'
   AND (
     (payment_proof_url IS NOT NULL AND length(payment_proof_url) > 0)
     OR payment_submitted_at IS NOT NULL
   );
