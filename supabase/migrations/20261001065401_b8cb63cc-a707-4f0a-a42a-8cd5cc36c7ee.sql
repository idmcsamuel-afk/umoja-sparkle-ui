CREATE OR REPLACE FUNCTION public.start_circle_bid_paystack(p_bid_id uuid, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b public.circle_bids%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_reference IS NULL OR length(p_reference) > 100 THEN RAISE EXCEPTION 'invalid_reference'; END IF;
  SELECT * INTO b FROM public.circle_bids WHERE id = p_bid_id FOR UPDATE;
  IF b.id IS NULL OR b.member_id <> uid THEN RAISE EXCEPTION 'bid_not_found'; END IF;
  IF COALESCE(b.status,'pending') NOT IN ('pending','payment_pending') THEN
    RAISE EXCEPTION 'bid_not_awaiting_payment';
  END IF;

  PERFORM set_config('app.allow_bid_write', 'on', true);
  UPDATE public.circle_bids SET
    status = 'payment_pending',
    payment_method = 'paystack',
    paystack_reference = p_reference,
    payment_reference = p_reference,
    payment_submitted_at = now()
  WHERE id = p_bid_id;
  PERFORM set_config('app.allow_bid_write', 'off', true);

  RETURN jsonb_build_object('ok', true, 'bid_id', p_bid_id);
END;
$$;
REVOKE ALL ON FUNCTION public.start_circle_bid_paystack(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_circle_bid_paystack(uuid, text) TO authenticated;