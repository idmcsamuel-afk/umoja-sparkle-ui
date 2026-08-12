ALTER TABLE public.spark_transactions DROP CONSTRAINT IF EXISTS spark_transactions_tx_type_check;
ALTER TABLE public.spark_transactions ADD CONSTRAINT spark_transactions_tx_type_check CHECK (tx_type = ANY (ARRAY['referral_bonus','signup_bonus','circle_contribution','circle_payout','spark_trade_join','spark_exchange_buy','spark_exchange_sell','game_entry','game_win','admin_adjustment','manual_credit','referral_signup','referral_kyc_bonus','referral_admin_bonus','tender_unlock','tender_unlock_refund']));

CREATE OR REPLACE FUNCTION public.refund_tender_unlock(p_member uuid, p_tender_id uuid, p_unlock_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unlock public.tender_unlocks%ROWTYPE;
  v_cost numeric;
  v_balance numeric;
BEGIN
  IF p_member IS NULL THEN RAISE EXCEPTION 'member required'; END IF;

  SELECT * INTO v_unlock FROM public.tender_unlocks
   WHERE member_id = p_member AND tender_id = p_tender_id AND unlock_type = p_unlock_type;
  IF v_unlock.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_unlock');
  END IF;

  v_cost := COALESCE(v_unlock.sparks_spent, 0);

  IF v_cost > 0 THEN
    PERFORM set_config('app.allow_wallet_write', 'on', true);
    UPDATE public.spark_wallets SET
      earned_balance = COALESCE(earned_balance,0) + v_cost,
      balance = COALESCE(balance,0) + v_cost,
      updated_at = now()
    WHERE member_id = p_member;
    PERFORM set_config('app.allow_wallet_write', 'off', true);

    INSERT INTO public.spark_transactions (to_member, amount, tx_type, status, description)
    VALUES (p_member, v_cost, 'tender_unlock_refund', 'completed',
      'Refund — tender ' || p_unlock_type || ' failed');

    IF v_unlock.spark_transaction_id IS NOT NULL THEN
      UPDATE public.spark_transactions SET status = 'reversed'
       WHERE id = v_unlock.spark_transaction_id;
    END IF;
  END IF;

  DELETE FROM public.tender_unlocks WHERE id = v_unlock.id;

  SELECT balance INTO v_balance FROM public.spark_wallets WHERE member_id = p_member;
  RETURN jsonb_build_object('ok', true, 'refunded', v_cost, 'balance', v_balance);
END $$;

REVOKE ALL ON FUNCTION public.refund_tender_unlock(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_tender_unlock(uuid, uuid, text) TO service_role;