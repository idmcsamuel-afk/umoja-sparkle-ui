
CREATE OR REPLACE FUNCTION public.admin_promote_bid_to_vault(_bid_id uuid)
RETURNS TABLE(bid_id uuid, new_status text, vault_start timestamptz, vault_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_days int;
  v_start timestamptz := now();
  v_end timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT cb.tier INTO v_tier FROM public.circle_bids cb WHERE cb.id = _bid_id;
  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  SELECT ct.vault_days INTO v_days FROM public.circle_tiers ct WHERE ct.tier = v_tier;
  IF v_days IS NULL THEN v_days := 30; END IF;
  v_end := v_start + (v_days || ' days')::interval;

  UPDATE public.circle_bids
     SET status = 'vault',
         vault_start = COALESCE(vault_start, v_start),
         vault_end   = COALESCE(vault_end, v_end),
         allocated_at = COALESCE(allocated_at, now()),
         updated_at = now()
   WHERE id = _bid_id
     AND status = 'active'
     AND payment_confirmed_at IS NOT NULL;

  INSERT INTO public.admin_audit_log(actor_id, action, details)
    VALUES (auth.uid(), 'circle_bid.admin_promote_to_vault',
            jsonb_build_object('bid_id', _bid_id, 'vault_start', v_start, 'vault_end', v_end));

  RETURN QUERY
    SELECT cb.id, cb.status, cb.vault_start, cb.vault_end
      FROM public.circle_bids cb WHERE cb.id = _bid_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promote_bid_to_vault(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_promote_bid_to_vault(uuid) TO authenticated, service_role;
