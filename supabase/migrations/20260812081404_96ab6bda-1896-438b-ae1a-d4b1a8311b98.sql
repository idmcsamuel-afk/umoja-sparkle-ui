ALTER TABLE public.tender_intents
  ADD COLUMN IF NOT EXISTS brings_tags text[],
  ADD COLUMN IF NOT EXISTS needs_tags text[];

CREATE TABLE IF NOT EXISTS public.intent_capability_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  tag_group text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.intent_capability_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intent_capability_tags TO authenticated;
GRANT ALL ON public.intent_capability_tags TO service_role;

ALTER TABLE public.intent_capability_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active capability tags"
  ON public.intent_capability_tags FOR SELECT
  USING (active OR public.is_admin_user());

CREATE POLICY "Admins manage capability tags"
  ON public.intent_capability_tags FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE TRIGGER trg_intent_capability_tags_updated_at
  BEFORE UPDATE ON public.intent_capability_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.intent_capability_tags (slug, label, tag_group, sort_order) VALUES
  ('catering','Catering & food services','sector',10),
  ('construction','Construction & civils','sector',20),
  ('it_hardware','IT & hardware','sector',30),
  ('transport_logistics','Transport & logistics','sector',40),
  ('cleaning','Cleaning & hygiene','sector',50),
  ('security','Security services','sector',60),
  ('consulting','Consulting & advisory','sector',70),
  ('professional_services','Professional services','sector',80),
  ('maintenance','Facilities & maintenance','sector',90),
  ('stationery_supplies','Stationery & general supplies','sector',100),
  ('medical_supplies','Medical & PPE supplies','sector',110),
  ('training','Training & skills development','sector',120),
  ('bbbee_level_1','B-BBEE Level 1','consortium',10),
  ('bbbee_level_2','B-BBEE Level 2','consortium',20),
  ('bbbee_level_3','B-BBEE Level 3','consortium',30),
  ('bbbee_level_4','B-BBEE Level 4','consortium',40),
  ('bbbee_level_5_8','B-BBEE Level 5-8','consortium',50),
  ('bbbee_eme','EME (Exempted Micro Enterprise)','consortium',60),
  ('bbbee_qse','QSE (Qualifying Small Enterprise)','consortium',70),
  ('equipment_assets','Equipment / assets','consortium',80),
  ('working_capital','Working capital','consortium',90),
  ('staff_capacity','Staff / labour capacity','consortium',100),
  ('govt_experience','Past government contract experience','consortium',110),
  ('certification_licence','Professional certification / licence','consortium',120),
  ('csd_registered','CSD registered','consortium',130),
  ('tax_compliant','Tax compliant','consortium',140),
  ('local_presence','Local presence in delivery province','consortium',150)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_tender_intent(
  p_tender_id uuid,
  p_intent text,
  p_visibility text DEFAULT 'visible'::text,
  p_brings text DEFAULT NULL::text,
  p_needs text DEFAULT NULL::text,
  p_brings_tags text[] DEFAULT NULL::text[],
  p_needs_tags text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.tender_intents;
  v_brings_tags text[];
  v_needs_tags text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT array_agg(DISTINCT t) INTO v_brings_tags
    FROM unnest(coalesce(p_brings_tags, '{}'::text[])) t
    WHERE EXISTS (SELECT 1 FROM public.intent_capability_tags c WHERE c.slug = t AND c.active);
  SELECT array_agg(DISTINCT t) INTO v_needs_tags
    FROM unnest(coalesce(p_needs_tags, '{}'::text[])) t
    WHERE EXISTS (SELECT 1 FROM public.intent_capability_tags c WHERE c.slug = t AND c.active);

  INSERT INTO public.tender_intents (tender_id, member_id, intent, visibility, brings, needs, brings_tags, needs_tags, active)
  VALUES (p_tender_id, v_uid, p_intent, coalesce(p_visibility,'visible'), p_brings, p_needs, v_brings_tags, v_needs_tags, true)
  ON CONFLICT (tender_id, member_id) DO UPDATE
    SET intent = EXCLUDED.intent,
        visibility = EXCLUDED.visibility,
        brings = EXCLUDED.brings,
        needs = EXCLUDED.needs,
        brings_tags = EXCLUDED.brings_tags,
        needs_tags = EXCLUDED.needs_tags,
        active = true
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'intent', v_row.intent, 'visibility', v_row.visibility,
    'brings', v_row.brings, 'needs', v_row.needs,
    'brings_tags', to_jsonb(coalesce(v_row.brings_tags, '{}'::text[])),
    'needs_tags', to_jsonb(coalesce(v_row.needs_tags, '{}'::text[])),
    'active', v_row.active);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_tender_intent(uuid, text, text, text, text, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tender_intent(uuid, text, text, text, text, text[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_tender_intent(p_tender_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT to_jsonb(x) FROM (
    SELECT intent, visibility, brings, needs,
           coalesce(brings_tags, '{}'::text[]) AS brings_tags,
           coalesce(needs_tags, '{}'::text[]) AS needs_tags,
           active
    FROM public.tender_intents
    WHERE tender_id = p_tender_id AND member_id = auth.uid()
  ) x;
$function$;

DROP FUNCTION IF EXISTS public.tender_open_partners(uuid);
CREATE FUNCTION public.tender_open_partners(p_tender_id uuid)
RETURNS TABLE(member_id uuid, full_name text, province text, brings text, needs text, brings_tags text[], needs_tags text[], created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ti.member_id,
         NULLIF(TRIM(m.full_name), '')::text AS full_name,
         NULLIF(TRIM(m.province), '')::text AS province,
         ti.brings,
         ti.needs,
         coalesce(ti.brings_tags, '{}'::text[]) AS brings_tags,
         coalesce(ti.needs_tags, '{}'::text[]) AS needs_tags,
         ti.created_at
  FROM public.tender_intents ti
  JOIN public.members m ON m.id = ti.member_id
  WHERE ti.tender_id = p_tender_id
    AND ti.active
    AND ti.intent = 'open_to_partner'
  ORDER BY ti.created_at ASC;
$function$;

REVOKE ALL ON FUNCTION public.tender_open_partners(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tender_open_partners(uuid) TO anon, authenticated;