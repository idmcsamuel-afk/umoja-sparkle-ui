
CREATE OR REPLACE FUNCTION public.circle_bids_guard_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.spark_amount IS DISTINCT FROM OLD.spark_amount
     OR NEW.fiat_amount IS DISTINCT FROM OLD.fiat_amount
     OR NEW.payout_amount IS DISTINCT FROM OLD.payout_amount
     OR NEW.priority_score IS DISTINCT FROM OLD.priority_score
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.quarantined_at IS DISTINCT FROM OLD.quarantined_at
  THEN
    RAISE EXCEPTION 'Not allowed to modify protected circle_bids fields';
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill Nomfundo's bid into its vault window (bypass guard trigger locally)
DO $$
DECLARE v_days int;
BEGIN
  ALTER TABLE public.circle_bids DISABLE TRIGGER trg_circle_bids_guard_member_update;
  SELECT ct.vault_days INTO v_days
    FROM public.circle_tiers ct
    JOIN public.circle_bids cb ON cb.tier = ct.tier
   WHERE cb.id = '853ff28b-e74d-4090-a5c8-32087bc31a42';
  v_days := COALESCE(v_days, 30);

  UPDATE public.circle_bids
     SET status = 'vault',
         vault_start = COALESCE(vault_start, now()),
         vault_end   = COALESCE(vault_end, now() + (v_days || ' days')::interval),
         allocated_at = COALESCE(allocated_at, now()),
         updated_at = now()
   WHERE id = '853ff28b-e74d-4090-a5c8-32087bc31a42';

  ALTER TABLE public.circle_bids ENABLE TRIGGER trg_circle_bids_guard_member_update;
END $$;

INSERT INTO public.admin_audit_log(actor_id, action, details)
  VALUES (NULL, 'circle_bid.admin_promote_to_vault.backfill',
          jsonb_build_object('bid_id','853ff28b-e74d-4090-a5c8-32087bc31a42','member','Nomfundo Ngema'));
