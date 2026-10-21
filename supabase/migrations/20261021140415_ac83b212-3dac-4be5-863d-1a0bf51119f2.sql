
CREATE TABLE public.creator_feature_flags (key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.creator_feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_feature_flags TO authenticated;
GRANT ALL ON public.creator_feature_flags TO service_role;
ALTER TABLE public.creator_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY cff_read ON public.creator_feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY cff_admin ON public.creator_feature_flags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.creator_feature_flags(key, enabled) VALUES ('creator_studio_enabled', true), ('creator_generation_enabled', false);

CREATE TABLE public.creator_credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES public.members(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.creator_credit_wallets TO authenticated;
GRANT ALL ON public.creator_credit_wallets TO service_role;
ALTER TABLE public.creator_credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccw_own ON public.creator_credit_wallets FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.creator_wallet_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.allow_creator_wallet_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Not allowed to modify creator credit wallets directly';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_creator_wallet_guard BEFORE INSERT OR UPDATE OR DELETE ON public.creator_credit_wallets FOR EACH ROW EXECUTE FUNCTION public.creator_wallet_guard();

CREATE TABLE public.creator_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('purchase','spend','refund')),
  description text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX creator_credit_tx_purchase_ref ON public.creator_credit_transactions(reference) WHERE type = 'purchase';
CREATE UNIQUE INDEX creator_credit_tx_refund_ref ON public.creator_credit_transactions(reference) WHERE type = 'refund';
GRANT SELECT ON public.creator_credit_transactions TO authenticated;
GRANT ALL ON public.creator_credit_transactions TO service_role;
ALTER TABLE public.creator_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cct_own ON public.creator_credit_transactions FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.creator_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('script','character_sheet','image','video','voice','lipsync')),
  model_key text NOT NULL,
  route text NOT NULL,
  status text NOT NULL DEFAULT 'pending_charge' CHECK (status IN ('pending_charge','charged','generating','complete','failed','refunded')),
  credits_charged integer NOT NULL DEFAULT 0,
  cost_basis_usd numeric NOT NULL DEFAULT 0,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.creator_generation_jobs TO authenticated;
GRANT ALL ON public.creator_generation_jobs TO service_role;
ALTER TABLE public.creator_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cgj_own ON public.creator_generation_jobs FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.creator_model_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  route text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN ('script','character_sheet','image','video','voice','lipsync')),
  cost_basis_usd numeric NOT NULL CHECK (cost_basis_usd >= 0),
  margin_multiplier numeric NOT NULL DEFAULT 1.6 CHECK (margin_multiplier >= 1),
  credits_cost integer GENERATED ALWAYS AS (GREATEST(1, ceil(cost_basis_usd * margin_multiplier * 100))::integer) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_key, route));
GRANT SELECT ON public.creator_model_pricing TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_model_pricing TO authenticated;
GRANT ALL ON public.creator_model_pricing TO service_role;
ALTER TABLE public.creator_model_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY cmp_read ON public.creator_model_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY cmp_admin ON public.creator_model_pricing FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.creator_model_pricing(model_key, route, job_type, cost_basis_usd) VALUES
 ('placeholder-video-short','muapi','video',0.50),
 ('placeholder-video-short','higgsfield','video',0.65),
 ('placeholder-voice','elevenlabs','voice',0.05);

CREATE TABLE public.creator_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_zar numeric NOT NULL CHECK (price_zar >= 1),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.creator_credit_packs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_credit_packs TO authenticated;
GRANT ALL ON public.creator_credit_packs TO service_role;
ALTER TABLE public.creator_credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccp_read ON public.creator_credit_packs FOR SELECT TO authenticated USING (active OR public.is_admin(auth.uid()));
CREATE POLICY ccp_admin ON public.creator_credit_packs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.creator_credit_packs(name, credits, price_zar, sort_order) VALUES
 ('Starter', 500, 99, 1), ('Creator', 1500, 249, 2);

-- GATE
CREATE OR REPLACE FUNCTION public.charge_and_start_generation(p_model_key text, p_route text, p_job_type text, p_params jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pr record; w record; jid uuid := gen_random_uuid(); nb integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT coalesce((SELECT enabled FROM creator_feature_flags WHERE key='creator_studio_enabled'), false) THEN
    RAISE EXCEPTION 'creator_studio_disabled'; END IF;
  SELECT * INTO pr FROM creator_model_pricing WHERE model_key=p_model_key AND route=p_route AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'model_not_available'; END IF;
  IF pr.job_type <> p_job_type THEN RAISE EXCEPTION 'job_type_mismatch'; END IF;
  SELECT * INTO w FROM creator_credit_wallets WHERE member_id=uid FOR UPDATE;
  IF NOT FOUND OR w.balance < pr.credits_cost THEN
    RAISE EXCEPTION 'insufficient_credits (balance %, required %)', coalesce(w.balance,0), pr.credits_cost USING ERRCODE='P0001';
  END IF;
  PERFORM set_config('app.allow_creator_wallet_write','on',true);
  UPDATE creator_credit_wallets SET balance = balance - pr.credits_cost, lifetime_spent = lifetime_spent + pr.credits_cost
    WHERE member_id=uid RETURNING balance INTO nb;
  PERFORM set_config('app.allow_creator_wallet_write','off',true);
  INSERT INTO creator_generation_jobs(id, member_id, job_type, model_key, route, status, credits_charged, cost_basis_usd, params)
    VALUES (jid, uid, p_job_type, p_model_key, p_route, 'charged', pr.credits_cost, pr.cost_basis_usd, coalesce(p_params,'{}'::jsonb));
  INSERT INTO creator_credit_transactions(member_id, amount, type, description, reference)
    VALUES (uid, pr.credits_cost, 'spend', p_job_type||' · '||p_model_key||' via '||p_route, jid::text);
  RETURN jsonb_build_object('job_id', jid, 'balance', nb, 'credits_charged', pr.credits_cost);
END $$;
REVOKE ALL ON FUNCTION public.charge_and_start_generation(text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_and_start_generation(text,text,text,jsonb) TO authenticated;

-- REFUND (service role only)
CREATE OR REPLACE FUNCTION public.refund_generation(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j record; nb integer;
BEGIN
  SELECT * INTO j FROM creator_generation_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF j.status = 'refunded' THEN RAISE EXCEPTION 'already_refunded'; END IF;
  IF j.status = 'complete' THEN RAISE EXCEPTION 'job_complete_not_refundable'; END IF;
  PERFORM set_config('app.allow_creator_wallet_write','on',true);
  UPDATE creator_credit_wallets SET balance = balance + j.credits_charged, lifetime_spent = GREATEST(0, lifetime_spent - j.credits_charged)
    WHERE member_id=j.member_id RETURNING balance INTO nb;
  PERFORM set_config('app.allow_creator_wallet_write','off',true);
  INSERT INTO creator_credit_transactions(member_id, amount, type, description, reference)
    VALUES (j.member_id, j.credits_charged, 'refund', 'Refund for failed generation', j.id::text);
  UPDATE creator_generation_jobs SET status='refunded', updated_at=now() WHERE id=j.id;
  RETURN jsonb_build_object('job_id', j.id, 'balance', nb);
END $$;
REVOKE ALL ON FUNCTION public.refund_generation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation(uuid) TO service_role;

-- PURCHASE CREDIT (service role only, called after Paystack verification)
CREATE OR REPLACE FUNCTION public.credit_creator_purchase(p_member uuid, p_pack_id uuid, p_reference text, p_amount_paid_zar numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pk record; nb integer;
BEGIN
  IF EXISTS (SELECT 1 FROM creator_credit_transactions WHERE type='purchase' AND reference=p_reference) THEN
    RETURN jsonb_build_object('applied', true, 'reason', 'already_recorded');
  END IF;
  SELECT * INTO pk FROM creator_credit_packs WHERE id=p_pack_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_not_found'; END IF;
  IF p_amount_paid_zar < pk.price_zar THEN RAISE EXCEPTION 'amount_below_pack_price (paid %, price %)', p_amount_paid_zar, pk.price_zar; END IF;
  PERFORM set_config('app.allow_creator_wallet_write','on',true);
  INSERT INTO creator_credit_wallets(member_id, balance, lifetime_purchased) VALUES (p_member, pk.credits, pk.credits)
    ON CONFLICT (member_id) DO UPDATE SET balance = creator_credit_wallets.balance + pk.credits,
      lifetime_purchased = creator_credit_wallets.lifetime_purchased + pk.credits
    RETURNING balance INTO nb;
  PERFORM set_config('app.allow_creator_wallet_write','off',true);
  INSERT INTO creator_credit_transactions(member_id, amount, type, description, reference)
    VALUES (p_member, pk.credits, 'purchase', pk.name||' pack ('||pk.credits||' credits)', p_reference);
  RETURN jsonb_build_object('applied', true, 'balance', nb, 'credits', pk.credits);
END $$;
REVOKE ALL ON FUNCTION public.credit_creator_purchase(uuid,uuid,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_creator_purchase(uuid,uuid,text,numeric) TO service_role;
