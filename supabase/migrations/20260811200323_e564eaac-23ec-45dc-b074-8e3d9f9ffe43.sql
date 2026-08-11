-- ============ tenders ============
CREATE TABLE public.tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocid text NOT NULL UNIQUE,
  release_id text,
  reference_number text,
  title text,
  description text,
  buyer_name text,
  province text,
  category text,
  procurement_method text,
  status text,
  value_amount numeric,
  value_currency text DEFAULT 'ZAR',
  published_at timestamptz,
  closing_at timestamptz,
  briefing_at timestamptz,
  briefing_compulsory boolean,
  source_url text,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenders_closing_at ON public.tenders (closing_at DESC);
CREATE INDEX idx_tenders_published_at ON public.tenders (published_at DESC);
CREATE INDEX idx_tenders_province ON public.tenders (province);
CREATE INDEX idx_tenders_category ON public.tenders (category);

GRANT SELECT ON public.tenders TO anon;
GRANT SELECT ON public.tenders TO authenticated;
GRANT ALL ON public.tenders TO service_role;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenders are viewable by everyone"
  ON public.tenders FOR SELECT USING (true);
CREATE POLICY "Admins can manage tenders"
  ON public.tenders FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ============ tender_unlocks ============
CREATE TABLE public.tender_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'sparks',
  sparks_spent numeric NOT NULL DEFAULT 0,
  spark_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, tender_id)
);
CREATE INDEX idx_tender_unlocks_member ON public.tender_unlocks (member_id);

GRANT SELECT ON public.tender_unlocks TO authenticated;
GRANT ALL ON public.tender_unlocks TO service_role;
ALTER TABLE public.tender_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own unlocks"
  ON public.tender_unlocks FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_admin_user());

-- ============ tender_alerts ============
CREATE TABLE public.tender_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name text,
  keywords text[] NOT NULL DEFAULT '{}',
  provinces text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  min_value numeric,
  max_value numeric,
  frequency text NOT NULL DEFAULT 'daily',
  channel text NOT NULL DEFAULT 'email',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tender_alerts_member ON public.tender_alerts (member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_alerts TO authenticated;
GRANT ALL ON public.tender_alerts TO service_role;
ALTER TABLE public.tender_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own alerts"
  ON public.tender_alerts FOR ALL TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

-- ============ tender_subscriptions ============
CREATE TABLE public.tender_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'tenders_pro',
  status text NOT NULL DEFAULT 'inactive',
  amount_zar numeric,
  payment_reference text,
  started_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_tender_subs_member_plan ON public.tender_subscriptions (member_id, plan);

GRANT SELECT ON public.tender_subscriptions TO authenticated;
GRANT ALL ON public.tender_subscriptions TO service_role;
ALTER TABLE public.tender_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own tender subscription"
  ON public.tender_subscriptions FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_admin_user());

-- ============ tender_ai_outputs ============
CREATE TABLE public.tender_ai_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'summary',
  model text,
  content text,
  content_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tender_ai_outputs_tender ON public.tender_ai_outputs (tender_id);

GRANT SELECT ON public.tender_ai_outputs TO authenticated;
GRANT ALL ON public.tender_ai_outputs TO service_role;
ALTER TABLE public.tender_ai_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own or shared AI outputs"
  ON public.tender_ai_outputs FOR SELECT TO authenticated
  USING (member_id IS NULL OR member_id = auth.uid() OR public.is_admin_user());

-- ============ tender_feature_flags ============
CREATE TABLE public.tender_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  value jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tender_feature_flags TO anon;
GRANT SELECT ON public.tender_feature_flags TO authenticated;
GRANT ALL ON public.tender_feature_flags TO service_role;
ALTER TABLE public.tender_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature flags readable by everyone"
  ON public.tender_feature_flags FOR SELECT USING (true);
CREATE POLICY "Admins manage feature flags"
  ON public.tender_feature_flags FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

INSERT INTO public.tender_feature_flags (key, enabled, description) VALUES
  ('spark_payments_enabled', true, 'Allow unlocking tenders with Sparks'),
  ('tenders_module_enabled', true, 'Master switch for the UMOJA Tenders module'),
  ('cash_subscriptions_enabled', false, 'Allow cash (Paystack) tender subscriptions'),
  ('ai_bid_assist_enabled', false, 'Enable AI bid assistance outputs')
ON CONFLICT (key) DO NOTHING;

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.tender_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tenders_updated_at BEFORE UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.tender_set_updated_at();
CREATE TRIGGER trg_tender_alerts_updated_at BEFORE UPDATE ON public.tender_alerts
  FOR EACH ROW EXECUTE FUNCTION public.tender_set_updated_at();
CREATE TRIGGER trg_tender_subscriptions_updated_at BEFORE UPDATE ON public.tender_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tender_set_updated_at();
CREATE TRIGGER trg_tender_feature_flags_updated_at BEFORE UPDATE ON public.tender_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.tender_set_updated_at();