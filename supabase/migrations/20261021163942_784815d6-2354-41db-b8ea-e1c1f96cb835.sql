ALTER TABLE public.creator_generation_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS units integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source text;
CREATE UNIQUE INDEX IF NOT EXISTS cgj_idem_active ON public.creator_generation_jobs(member_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('charged','generating','complete');

ALTER TABLE public.member_generated_videos ADD COLUMN IF NOT EXISTS billing_job_id uuid;
ALTER TABLE public.ai_generated_videos ADD COLUMN IF NOT EXISTS billing_job_id uuid;

CREATE TABLE IF NOT EXISTS public.creator_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_settings TO authenticated;
GRANT ALL ON public.creator_settings TO service_role;
ALTER TABLE public.creator_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_admin ON public.creator_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
INSERT INTO public.creator_settings(key, value) VALUES ('marketing_member_id', '12469fec-57da-41b8-8a40-2c9610bfbc21')
  ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._creator_charge(p_member uuid, p_model_key text, p_route text, p_job_type text,
  p_params jsonb, p_idem text, p_units integer, p_source text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; w record; ex record; jid uuid := gen_random_uuid(); nb integer; total integer; u integer := GREATEST(1, coalesce(p_units,1));
BEGIN
  IF p_member IS NULL THEN RAISE EXCEPTION 'member_required'; END IF;
  IF NOT coalesce((SELECT enabled FROM creator_feature_flags WHERE key='creator_studio_enabled'), false) THEN
    RAISE EXCEPTION 'creator_studio_disabled'; END IF;
  IF NOT coalesce((SELECT enabled FROM creator_feature_flags WHERE key='creator_generation_enabled'), false) THEN
    RAISE EXCEPTION 'generation_disabled'; END IF;
  IF p_idem IS NOT NULL THEN
    SELECT * INTO ex FROM creator_generation_jobs WHERE member_id=p_member AND idempotency_key=p_idem
      AND status IN ('charged','generating','complete') LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('job_id', ex.id, 'duplicate', true, 'status', ex.status, 'credits_charged', ex.credits_charged);
    END IF;
  END IF;
  SELECT * INTO pr FROM creator_model_pricing WHERE model_key=p_model_key AND route=p_route AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'model_not_available'; END IF;
  IF pr.job_type <> p_job_type THEN RAISE EXCEPTION 'job_type_mismatch'; END IF;
  total := pr.credits_cost * u;
  SELECT * INTO w FROM creator_credit_wallets WHERE member_id=p_member FOR UPDATE;
  IF NOT FOUND OR w.balance < total THEN
    RAISE EXCEPTION 'insufficient_credits (balance %, required %)', coalesce(w.balance,0), total USING ERRCODE='P0001';
  END IF;
  PERFORM set_config('app.allow_creator_wallet_write','on',true);
  UPDATE creator_credit_wallets SET balance = balance - total, lifetime_spent = lifetime_spent + total
    WHERE member_id=p_member RETURNING balance INTO nb;
  PERFORM set_config('app.allow_creator_wallet_write','off',true);
  INSERT INTO creator_generation_jobs(id, member_id, job_type, model_key, route, status, credits_charged, cost_basis_usd, params, idempotency_key, units, source)
    VALUES (jid, p_member, p_job_type, p_model_key, p_route, 'charged', total, pr.cost_basis_usd * u, coalesce(p_params,'{}'::jsonb), p_idem, u, p_source);
  INSERT INTO creator_credit_transactions(member_id, amount, type, description, reference)
    VALUES (p_member, total, 'spend', p_job_type||' · '||p_model_key||' via '||p_route||CASE WHEN u>1 THEN ' ×'||u ELSE '' END, jid::text);
  RETURN jsonb_build_object('job_id', jid, 'duplicate', false, 'status', 'charged', 'balance', nb, 'credits_charged', total);
END $$;
REVOKE ALL ON FUNCTION public._creator_charge(uuid,text,text,text,jsonb,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._creator_charge(uuid,text,text,text,jsonb,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.charge_and_start_generation(p_model_key text, p_route text, p_job_type text, p_params jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN public._creator_charge(auth.uid(), p_model_key, p_route, p_job_type, coalesce(p_params,'{}'::jsonb),
    p_params->>'idempotency_key', coalesce((p_params->>'units')::int, 1), 'member');
END $$;
REVOKE ALL ON FUNCTION public.charge_and_start_generation(text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.charge_and_start_generation(text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.charge_generation_for_member(p_member uuid, p_model_key text, p_route text, p_job_type text,
  p_params jsonb DEFAULT '{}'::jsonb, p_idem text DEFAULT NULL, p_units integer DEFAULT 1, p_source text DEFAULT 'server')
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._creator_charge(p_member, p_model_key, p_route, p_job_type, p_params, p_idem, p_units, p_source);
$$;
REVOKE ALL ON FUNCTION public.charge_generation_for_member(uuid,text,text,text,jsonb,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_generation_for_member(uuid,text,text,text,jsonb,text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.start_generation_job(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  IF NOT coalesce((SELECT enabled FROM creator_feature_flags WHERE key='creator_generation_enabled'), false) THEN
    RAISE EXCEPTION 'generation_disabled'; END IF;
  UPDATE creator_generation_jobs SET status='generating', updated_at=now() WHERE id=p_job_id AND status='charged' RETURNING status INTO s;
  IF s IS NULL THEN
    SELECT status INTO s FROM creator_generation_jobs WHERE id=p_job_id;
    RETURN jsonb_build_object('started', false, 'status', s);
  END IF;
  RETURN jsonb_build_object('started', true, 'status', s);
END $$;
REVOKE ALL ON FUNCTION public.start_generation_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_generation_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_generation_job(p_job_id uuid, p_result_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s text;
BEGIN
  UPDATE creator_generation_jobs SET status='complete', result_url=coalesce(p_result_url, result_url), updated_at=now()
    WHERE id=p_job_id AND status IN ('charged','generating') RETURNING status INTO s;
  RETURN jsonb_build_object('completed', s IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.complete_generation_job(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_generation_job(uuid,text) TO service_role;

UPDATE public.creator_model_pricing SET active=false, updated_at=now() WHERE model_key LIKE 'placeholder-%';
INSERT INTO public.creator_model_pricing(model_key, route, job_type, cost_basis_usd) VALUES
 ('claude-sonnet-4','anthropic-trend','script',0.05),
 ('claude-sonnet-4','anthropic-script','script',0.06),
 ('claude-sonnet-4','anthropic-caption','script',0.01),
 ('claude-sonnet-4','anthropic-director-batch','script',0.25),
 ('eleven-multilingual-v2','elevenlabs-standard','voice',0.20),
 ('eleven-multilingual-v2','elevenlabs-premium','voice',0.30),
 ('heygen-avatar-v2','heygen-talking-head','video',1.00),
 ('stock-faceless','assembly','video',0.05)
ON CONFLICT (model_key, route) DO NOTHING;