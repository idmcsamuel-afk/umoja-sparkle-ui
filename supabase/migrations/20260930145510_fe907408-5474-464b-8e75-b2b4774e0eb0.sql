CREATE OR REPLACE FUNCTION public.circle_bids_guard_member_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR auth.role() = 'service_role'
     OR current_setting('app.allow_bid_write', true) = 'on' THEN
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

CREATE OR REPLACE FUNCTION public.submit_circle_bid_proof(p_bid_id uuid, p_proof_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.circle_bids%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO b FROM public.circle_bids WHERE id = p_bid_id FOR UPDATE;
  IF b.id IS NULL OR b.member_id <> uid THEN RAISE EXCEPTION 'bid_not_found'; END IF;
  IF COALESCE(b.status,'pending') NOT IN ('pending','payment_pending') THEN
    RAISE EXCEPTION 'bid_not_awaiting_payment';
  END IF;
  IF p_proof_path IS NULL OR split_part(p_proof_path,'/',1) <> uid::text THEN
    RAISE EXCEPTION 'invalid_proof_path';
  END IF;

  PERFORM set_config('app.allow_bid_write', 'on', true);
  UPDATE public.circle_bids SET
    status = 'payment_pending',
    payment_proof_url = p_proof_path,
    payment_method = 'eft',
    payment_submitted_at = now()
  WHERE id = p_bid_id;
  PERFORM set_config('app.allow_bid_write', 'off', true);

  RETURN jsonb_build_object('ok', true, 'bid_id', p_bid_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_circle_bid_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_circle_bid_proof(uuid, text) TO authenticated;