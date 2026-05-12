-- Extend properties for modular projects
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_kind text NOT NULL DEFAULT 'traditional', -- 'traditional' | 'modular_project'
  ADD COLUMN IF NOT EXISTS modular_supplier text,
  ADD COLUMN IF NOT EXISTS modular_model text,
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS bathrooms integer,
  ADD COLUMN IF NOT EXISTS size_sqm numeric,
  ADD COLUMN IF NOT EXISTS plot_size_sqm numeric,
  ADD COLUMN IF NOT EXISTS title_deed_number text,
  ADD COLUMN IF NOT EXISTS title_deed_url text,
  ADD COLUMN IF NOT EXISTS land_cost numeric,
  ADD COLUMN IF NOT EXISTS home_cost numeric,
  ADD COLUMN IF NOT EXISTS site_prep_cost numeric,
  ADD COLUMN IF NOT EXISTS assembly_cost numeric,
  ADD COLUMN IF NOT EXISTS connection_cost numeric,
  ADD COLUMN IF NOT EXISTS contingency_cost numeric,
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS expected_monthly_rental numeric,
  ADD COLUMN IF NOT EXISTS project_stage text DEFAULT 'land_secured', -- land_secured|funding|ordered|delivery|assembly|tenant_ready
  ADD COLUMN IF NOT EXISTS funding_deadline date,
  ADD COLUMN IF NOT EXISTS home_order_date date,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS assembly_complete_date date,
  ADD COLUMN IF NOT EXISTS tenant_ready_date date,
  ADD COLUMN IF NOT EXISTS gallery_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_info jsonb;

-- Status updates / milestones for projects
CREATE TABLE IF NOT EXISTS public.property_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage text NOT NULL,
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  is_complete boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones public read" ON public.property_milestones
  FOR SELECT USING (true);
CREATE POLICY "milestones admin write" ON public.property_milestones
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_property_milestones_prop ON public.property_milestones(property_id, occurred_at DESC);

-- Modular catalog (reusable home models)
CREATE TABLE IF NOT EXISTS public.modular_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  size_sqm numeric NOT NULL,
  base_price_zar numeric NOT NULL,
  delivery_weeks integer NOT NULL DEFAULT 6,
  assembly_weeks integer NOT NULL DEFAULT 2,
  min_plot_sqm numeric,
  description text,
  image_url text,
  floor_plan_url text,
  supplier text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modular_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modular_models public read" ON public.modular_models
  FOR SELECT USING (true);
CREATE POLICY "modular_models admin write" ON public.modular_models
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Admin write access on properties (for new admin manager)
DO $$ BEGIN
  CREATE POLICY "properties admin write" ON public.properties
    FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed a few modular models
INSERT INTO public.modular_models (name, bedrooms, bathrooms, size_sqm, base_price_zar, delivery_weeks, assembly_weeks, min_plot_sqm, description, supplier)
VALUES
  ('2-Bed Starter', 2, 1, 60, 250000, 5, 2, 200, 'Compact starter home, ideal for couples or small families.', 'Shenzhen ModuHome Co.'),
  ('3-Bed Family', 3, 2, 120, 350000, 6, 2, 400, 'Modern open-plan family home with covered patio.', 'Shenzhen ModuHome Co.'),
  ('4-Bed Executive', 4, 3, 180, 550000, 8, 3, 600, 'Spacious executive layout with double-volume living.', 'Guangzhou PrefabPro'),
  ('Granny Flat', 1, 1, 35, 180000, 4, 1, 100, 'Backyard cottage / rental unit, plug-and-play.', 'Shenzhen ModuHome Co.')
ON CONFLICT DO NOTHING;