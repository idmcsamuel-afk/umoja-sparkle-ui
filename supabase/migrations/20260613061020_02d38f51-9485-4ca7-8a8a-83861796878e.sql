
-- 0) Widen status check first so the sweep is allowed
ALTER TABLE public.circle_bids DROP CONSTRAINT IF EXISTS circle_bids_status_check;
ALTER TABLE public.circle_bids ADD CONSTRAINT circle_bids_status_check
  CHECK (status = ANY (ARRAY[
    'pending','payment_pending','active','matched','paid','cancelled',
    'suspended','refunded','rejected','vault','payout_due','queued',
    'pending_payment','expired','overdue'
  ]));

-- 1) is_first_payout column + backfill
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS is_first_payout boolean NOT NULL DEFAULT false;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY member_id ORDER BY created_at ASC) AS rn
    FROM public.circle_bids
   WHERE status NOT IN ('rejected','expired')
)
UPDATE public.circle_bids cb
   SET is_first_payout = true
  FROM ranked r
 WHERE cb.id = r.id
   AND r.rn = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.circle_bids prev
      WHERE prev.member_id = cb.member_id
        AND prev.status = 'paid'
        AND prev.created_at < cb.created_at
   );

-- 2) Trigger to auto-set is_first_payout on insert
CREATE OR REPLACE FUNCTION public.set_circle_bid_first_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_first_payout IS NULL OR NEW.is_first_payout = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.circle_bids
       WHERE member_id = NEW.member_id
         AND status = 'paid'
    ) THEN
      NEW.is_first_payout := true;
    ELSE
      NEW.is_first_payout := false;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_circle_bid_first_payout ON public.circle_bids;
CREATE TRIGGER trg_set_circle_bid_first_payout
BEFORE INSERT ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public.set_circle_bid_first_payout();

-- 3) Overdue sweep function
CREATE OR REPLACE FUNCTION public.mark_overdue_circle_payouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH upd AS (
    UPDATE public.circle_bids
       SET status = 'overdue',
           updated_at = now()
     WHERE status = 'vault'
       AND vault_end IS NOT NULL
       AND vault_end < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO n FROM upd;

  IF n > 0 THEN
    INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
      VALUES (NULL, 'mark_overdue_circle_payouts', NULL,
              jsonb_build_object('marked', n, 'ran_at', now()));
  END IF;
  RETURN n;
END $$;

SELECT public.mark_overdue_circle_payouts();

-- 4) Schedule daily at 00:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('mark-overdue-circle-payouts-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'mark-overdue-circle-payouts-daily',
  '0 0 * * *',
  $cmd$ SELECT public.mark_overdue_circle_payouts(); $cmd$
);
