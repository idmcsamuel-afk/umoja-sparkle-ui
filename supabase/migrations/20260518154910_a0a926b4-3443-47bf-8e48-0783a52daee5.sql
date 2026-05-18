CREATE OR REPLACE FUNCTION public.circle_tier_stats()
RETURNS TABLE(tier text, pool numeric, members bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tier,
         COALESCE(SUM(net_amount), 0)::numeric AS pool,
         COUNT(DISTINCT member_id)::bigint AS members
    FROM public.circle_bids
   WHERE status IN ('pending','payment_pending','active','matched')
   GROUP BY tier;
$$;
GRANT EXECUTE ON FUNCTION public.circle_tier_stats() TO authenticated, anon;

ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS payment_window_hours integer DEFAULT 48,
  ADD COLUMN IF NOT EXISTS expiration_notified boolean DEFAULT false;

UPDATE public.circle_bids
   SET payment_deadline = COALESCE(payment_submitted_at, created_at) + interval '48 hours'
 WHERE status IN ('pending','payment_pending') AND payment_deadline IS NULL;

CREATE OR REPLACE FUNCTION public.set_bid_payment_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := COALESCE(NEW.created_at, now())
      + (COALESCE(NEW.payment_window_hours, 48) || ' hours')::interval;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_bid_payment_deadline ON public.circle_bids;
CREATE TRIGGER trg_set_bid_payment_deadline
BEFORE INSERT ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public.set_bid_payment_deadline();

DROP FUNCTION IF EXISTS public.expire_unpaid_bids();
CREATE FUNCTION public.expire_unpaid_bids()
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
    RETURNING id
  )
  SELECT COUNT(*) INTO n FROM upd;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_bids() TO authenticated;