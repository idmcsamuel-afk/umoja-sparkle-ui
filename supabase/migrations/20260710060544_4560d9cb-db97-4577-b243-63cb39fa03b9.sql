
-- Auto-promote bids to vault when payment is confirmed (works for admin, paystack, and any future path)
CREATE OR REPLACE FUNCTION public.circle_bids_auto_promote_vault()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int;
BEGIN
  -- Fire when payment_confirmed_at transitions from NULL to NOT NULL,
  -- the row is landing in an 'active' state, and vault isn't already set.
  IF NEW.payment_confirmed_at IS NOT NULL
     AND OLD.payment_confirmed_at IS NULL
     AND COALESCE(NEW.status, '') IN ('active', 'payment_pending', 'pending')
     AND NEW.vault_start IS NULL
  THEN
    SELECT ct.vault_days INTO v_days
      FROM public.circle_tiers ct
     WHERE ct.tier = NEW.tier;
    v_days := COALESCE(v_days, 30);

    NEW.status       := 'vault';
    NEW.vault_start  := COALESCE(NEW.vault_start, now());
    NEW.vault_end    := COALESCE(NEW.vault_end, now() + (v_days || ' days')::interval);
    NEW.allocated_at := COALESCE(NEW.allocated_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Name prefixed with "a_" so it runs BEFORE the alphabetically-later guard trigger.
DROP TRIGGER IF EXISTS a_trg_circle_bids_auto_promote_vault ON public.circle_bids;
CREATE TRIGGER a_trg_circle_bids_auto_promote_vault
BEFORE UPDATE ON public.circle_bids
FOR EACH ROW
EXECUTE FUNCTION public.circle_bids_auto_promote_vault();

-- Sweep: promote Mzoxolo and any other admin-confirmed bids stuck at 'active' with no vault window.
DO $$
DECLARE
  r RECORD;
  v_days int;
BEGIN
  ALTER TABLE public.circle_bids DISABLE TRIGGER trg_circle_bids_guard_member_update;
  ALTER TABLE public.circle_bids DISABLE TRIGGER a_trg_circle_bids_auto_promote_vault;

  FOR r IN
    SELECT cb.id, cb.tier
      FROM public.circle_bids cb
     WHERE cb.status = 'active'
       AND cb.payment_confirmed_at IS NOT NULL
       AND cb.vault_start IS NULL
  LOOP
    SELECT ct.vault_days INTO v_days FROM public.circle_tiers ct WHERE ct.tier = r.tier;
    v_days := COALESCE(v_days, 30);

    UPDATE public.circle_bids
       SET status       = 'vault',
           vault_start  = COALESCE(vault_start, now()),
           vault_end    = COALESCE(vault_end, now() + (v_days || ' days')::interval),
           allocated_at = COALESCE(allocated_at, now()),
           updated_at   = now()
     WHERE id = r.id;

    INSERT INTO public.admin_audit_log(actor_id, action, details)
      VALUES (NULL, 'circle_bid.auto_promote_to_vault.backfill',
              jsonb_build_object('bid_id', r.id, 'tier', r.tier));
  END LOOP;

  ALTER TABLE public.circle_bids ENABLE TRIGGER a_trg_circle_bids_auto_promote_vault;
  ALTER TABLE public.circle_bids ENABLE TRIGGER trg_circle_bids_guard_member_update;
END $$;
