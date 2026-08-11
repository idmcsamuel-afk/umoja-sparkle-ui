-- 1. unlock_type on tender_unlocks
ALTER TABLE public.tender_unlocks
  ADD COLUMN IF NOT EXISTS unlock_type text NOT NULL DEFAULT 'reveal';

ALTER TABLE public.tender_unlocks
  DROP CONSTRAINT IF EXISTS tender_unlocks_member_id_tender_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS tender_unlocks_member_tender_type_key
  ON public.tender_unlocks (member_id, tender_id, unlock_type);

GRANT SELECT ON public.tender_unlocks TO authenticated;
GRANT ALL ON public.tender_unlocks TO service_role;

-- 2. seed the spark flag if missing
INSERT INTO public.tender_feature_flags (key, enabled, value, description)
SELECT 'spark_payments_enabled', true, 'true'::jsonb, 'Allow Spark unlocks for tenders'
WHERE NOT EXISTS (SELECT 1 FROM public.tender_feature_flags WHERE key = 'spark_payments_enabled');

-- 3. unlock RPC
CREATE OR REPLACE FUNCTION public.unlock_tender(p_tender_id uuid, p_unlock_type text DEFAULT 'reveal')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_cost numeric;
  v_flag boolean;
  v_ocid text;
  w public.spark_wallets%ROWTYPE;
  v_promo numeric; v_earned numeric; v_purchased numeric;
  v_avail numeric; v_remaining numeric; v_take numeric;
  v_use_earned numeric := 0; v_use_purchased numeric := 0; v_use_promo numeric := 0;
  v_tx_id uuid;
  v_existing public.tender_unlocks%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_unlock_type NOT IN ('reveal','fit_check') THEN RAISE EXCEPTION 'invalid unlock_type'; END IF;
  v_cost := CASE p_unlock_type WHEN 'reveal' THEN 20 ELSE 10 END;

  SELECT ocid INTO v_ocid FROM public.tenders WHERE id = p_tender_id;
  IF v_ocid IS NULL THEN RAISE EXCEPTION 'tender_not_found'; END IF;

  -- Idempotent: already unlocked -> success, no charge
  SELECT * INTO v_existing FROM public.tender_unlocks
   WHERE member_id = uid AND tender_id = p_tender_id AND unlock_type = p_unlock_type;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_unlocked', true, 'sparks_spent', 0,
      'unlock_type', p_unlock_type);
  END IF;

  SELECT COALESCE(enabled, (value #>> '{}')::boolean) INTO v_flag
    FROM public.tender_feature_flags WHERE key = 'spark_payments_enabled';
  IF COALESCE(v_flag, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'spark_payments_disabled';
  END IF;

  PERFORM set_config('app.allow_wallet_write', 'on', true);

  SELECT * INTO w FROM public.spark_wallets WHERE member_id = uid FOR UPDATE;
  IF w.member_id IS NULL THEN RAISE EXCEPTION 'insufficient_sparks'; END IF;

  v_promo := CASE WHEN w.promo_expires_at IS NULL OR w.promo_expires_at > now()
                  THEN COALESCE(w.promotional_balance,0) ELSE 0 END;
  v_earned := COALESCE(w.earned_balance,0);
  v_purchased := COALESCE(w.purchased_balance,0);
  v_avail := v_earned + v_purchased + v_promo;
  IF v_avail < v_cost THEN
    RAISE EXCEPTION 'insufficient_sparks (available: %, required: %)', v_avail, v_cost;
  END IF;

  -- Deduct earned -> purchased -> promotional (same order as boost_circle_bid)
  v_remaining := v_cost;
  v_take := LEAST(v_earned, v_remaining);    v_use_earned := v_take;    v_remaining := v_remaining - v_take;
  v_take := LEAST(v_purchased, v_remaining); v_use_purchased := v_take; v_remaining := v_remaining - v_take;
  v_take := LEAST(v_promo, v_remaining);     v_use_promo := v_take;     v_remaining := v_remaining - v_take;

  UPDATE public.spark_wallets SET
    earned_balance      = COALESCE(earned_balance,0) - v_use_earned,
    purchased_balance   = COALESCE(purchased_balance,0) - v_use_purchased,
    promotional_balance = COALESCE(promotional_balance,0) - v_use_promo,
    balance = COALESCE(earned_balance,0) - v_use_earned
            + COALESCE(purchased_balance,0) - v_use_purchased
            + COALESCE(promotional_balance,0) - v_use_promo
            + COALESCE(referral_balance,0),
    updated_at = now()
  WHERE member_id = uid;

  PERFORM set_config('app.allow_wallet_write', 'off', true);

  INSERT INTO public.spark_transactions (from_member, amount, tx_type, status, description)
    VALUES (uid, -v_cost, 'tender_unlock', 'completed',
      'Tender ' || p_unlock_type || ' unlock — ' || v_ocid)
    RETURNING id INTO v_tx_id;

  INSERT INTO public.tender_unlocks (member_id, tender_id, unlock_type, method, sparks_spent, spark_transaction_id)
    VALUES (uid, p_tender_id, p_unlock_type, 'sparks', v_cost, v_tx_id)
    ON CONFLICT (member_id, tender_id, unlock_type) DO NOTHING;

  SELECT balance INTO v_avail FROM public.spark_wallets WHERE member_id = uid;

  RETURN jsonb_build_object('ok', true, 'already_unlocked', false, 'sparks_spent', v_cost,
    'unlock_type', p_unlock_type, 'balance', v_avail);
END $function$;

REVOKE ALL ON FUNCTION public.unlock_tender(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.unlock_tender(uuid, text) TO authenticated;

-- 4. Server-side gating: remove direct read access to premium columns
REVOKE SELECT ON public.tenders FROM anon, authenticated;
GRANT SELECT (id, ocid, release_id, title, description, buyer_name, province, category,
  procurement_method, status, value_amount, value_currency, published_at, closing_at,
  source_url, delivery_location, synced_at, created_at, updated_at)
  ON public.tenders TO anon, authenticated;
GRANT ALL ON public.tenders TO service_role;

-- 5. Gated detail RPC
CREATE OR REPLACE FUNCTION public.get_tender_detail(p_tender_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.tenders%ROWTYPE;
  v_unlocked boolean := false;
  v_base jsonb;
BEGIN
  SELECT * INTO t FROM public.tenders WHERE id = p_tender_id;
  IF t.id IS NULL THEN RETURN NULL; END IF;

  IF uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tender_unlocks
       WHERE member_id = uid AND tender_id = p_tender_id AND unlock_type = 'reveal'
    ) OR public.is_admin_user() INTO v_unlocked;
  END IF;

  v_base := jsonb_build_object(
    'id', t.id, 'ocid', t.ocid, 'title', t.title, 'description', t.description,
    'buyer_name', t.buyer_name, 'province', t.province, 'category', t.category,
    'procurement_method', t.procurement_method, 'status', t.status,
    'value_amount', t.value_amount, 'value_currency', t.value_currency,
    'published_at', t.published_at, 'closing_at', t.closing_at,
    'source_url', t.source_url, 'delivery_location', t.delivery_location,
    'unlocked', v_unlocked
  );

  IF v_unlocked THEN
    v_base := v_base || jsonb_build_object(
      'reference_number', t.reference_number,
      'contact_name', t.contact_name, 'contact_email', t.contact_email,
      'contact_phone', t.contact_phone,
      'briefing_at', t.briefing_at, 'briefing_compulsory', t.briefing_compulsory,
      'documents', COALESCE(t.documents, '[]'::jsonb)
    );
  END IF;

  RETURN v_base;
END $function$;

REVOKE ALL ON FUNCTION public.get_tender_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tender_detail(uuid) TO anon, authenticated;