
-- shared timestamp helper (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.fulfillment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  has_amazon BOOLEAN NOT NULL DEFAULT false,
  has_takealot BOOLEAN NOT NULL DEFAULT false,
  has_makro BOOLEAN NOT NULL DEFAULT false,
  needs_amazon BOOLEAN NOT NULL DEFAULT false,
  needs_takealot BOOLEAN NOT NULL DEFAULT false,
  needs_makro BOOLEAN NOT NULL DEFAULT false,
  amazon_seller_id TEXT,
  takealot_seller_id TEXT,
  makro_seller_id TEXT,
  expected_volume TEXT NOT NULL,
  product_categories TEXT[] NOT NULL DEFAULT '{}',
  other_category TEXT,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL,
  branch_code TEXT NOT NULL,
  agreed BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fulfillment_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fa_select" ON public.fulfillment_applications FOR SELECT USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "fa_insert" ON public.fulfillment_applications FOR INSERT WITH CHECK (member_id = auth.uid());
CREATE POLICY "fa_update" ON public.fulfillment_applications FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_fa_upd BEFORE UPDATE ON public.fulfillment_applications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fulfillment_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE,
  monthly_fee NUMERIC NOT NULL DEFAULT 1500,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_at TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  warehouse_address TEXT DEFAULT 'UMOJA Warehouse, 12 Industria Rd, Johannesburg, 2000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fulfillment_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fs_select" ON public.fulfillment_subscriptions FOR SELECT USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "fs_admin" ON public.fulfillment_subscriptions FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_fs_upd BEFORE UPDATE ON public.fulfillment_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fulfillment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('amazon','takealot','makro')),
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_city TEXT,
  customer_address TEXT,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_kg NUMERIC,
  size_tier TEXT CHECK (size_tier IN ('small','medium','large')),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','picked','packed','shipped','delivered','problem')),
  tracking_number TEXT,
  courier TEXT,
  problem_type TEXT,
  problem_description TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fulfillment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fo_select" ON public.fulfillment_orders FOR SELECT USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "fo_admin" ON public.fulfillment_orders FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_fo_upd BEFORE UPDATE ON public.fulfillment_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fulfillment_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  storage_location TEXT,
  expected_arrival DATE,
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','arrived','stored')),
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fulfillment_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fi_select" ON public.fulfillment_inventory FOR SELECT USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "fi_admin" ON public.fulfillment_inventory FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_fi_upd BEFORE UPDATE ON public.fulfillment_inventory FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fulfillment_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  base_fee NUMERIC NOT NULL DEFAULT 1500,
  small_item_count INTEGER NOT NULL DEFAULT 0,
  medium_item_count INTEGER NOT NULL DEFAULT 0,
  large_item_count INTEGER NOT NULL DEFAULT 0,
  handling_count INTEGER NOT NULL DEFAULT 0,
  item_fees NUMERIC NOT NULL DEFAULT 0,
  handling_fees NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, month, year)
);
ALTER TABLE public.fulfillment_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finv_select" ON public.fulfillment_invoices FOR SELECT USING (member_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "finv_admin" ON public.fulfillment_invoices FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_finv_upd BEFORE UPDATE ON public.fulfillment_invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.admin_approve_fulfillment(_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app public.fulfillment_applications%ROWTYPE; sub_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO app FROM public.fulfillment_applications WHERE id = _application_id;
  IF app.id IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  UPDATE public.fulfillment_applications SET status='approved', reviewed_by=auth.uid(), reviewed_at=now() WHERE id=_application_id;
  INSERT INTO public.fulfillment_subscriptions (member_id, monthly_fee, status, activated_at, next_billing_date)
    VALUES (app.member_id, 1500, 'active', now(), now() + interval '1 month')
    ON CONFLICT (member_id) DO UPDATE SET status='active', activated_at=now(), next_billing_date=now()+interval '1 month'
    RETURNING id INTO sub_id;
  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (app.member_id, 'Fulfilled by UMOJA approved 🚀', 'Welcome! Ship inventory to our warehouse to begin.', 'fulfillment', '/fulfillment/dashboard');
  RETURN sub_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_fulfillment(_application_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app public.fulfillment_applications%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO app FROM public.fulfillment_applications WHERE id = _application_id;
  IF app.id IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  UPDATE public.fulfillment_applications
    SET status='rejected', rejection_reason=_reason, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_application_id;
  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (app.member_id, 'Fulfillment application update', COALESCE(_reason,'Your application needs attention.'), 'fulfillment', '/dashboard');
END $$;
