CREATE TABLE public.product_pricing_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  alibaba_cost_zar TEXT,
  weight_kg TEXT,
  freight_override_zar TEXT,
  buffer_pct TEXT,
  commission_pct TEXT,
  moq TEXT,
  supplier_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, admin_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pricing_drafts TO authenticated;
GRANT ALL ON public.product_pricing_drafts TO service_role;

ALTER TABLE public.product_pricing_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage their own drafts"
ON public.product_pricing_drafts
FOR ALL
TO authenticated
USING (
  admin_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
)
WITH CHECK (
  admin_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.update_product_pricing_drafts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_pricing_drafts_updated_at
BEFORE UPDATE ON public.product_pricing_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_product_pricing_drafts_updated_at();

CREATE INDEX idx_product_pricing_drafts_admin ON public.product_pricing_drafts(admin_user_id);
