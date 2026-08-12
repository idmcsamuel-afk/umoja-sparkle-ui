CREATE TABLE public.tender_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  intent text NOT NULL DEFAULT 'solo',
  visibility text NOT NULL DEFAULT 'visible',
  brings text,
  needs text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tender_intents_unique UNIQUE (tender_id, member_id)
);

CREATE INDEX idx_tender_intents_tender ON public.tender_intents(tender_id) WHERE active;
CREATE INDEX idx_tender_intents_member ON public.tender_intents(member_id);

GRANT SELECT, INSERT, UPDATE ON public.tender_intents TO authenticated;
GRANT ALL ON public.tender_intents TO service_role;

ALTER TABLE public.tender_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own intent" ON public.tender_intents
  FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "Members create own intent" ON public.tender_intents
  FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY "Members update own intent" ON public.tender_intents
  FOR UPDATE TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "Admins read all intents" ON public.tender_intents
  FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.tender_intents_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.intent NOT IN ('solo','open_to_partner') THEN
    RAISE EXCEPTION 'invalid_intent';
  END IF;
  IF NEW.visibility NOT IN ('visible','private') THEN
    RAISE EXCEPTION 'invalid_visibility';
  END IF;
  IF NEW.intent = 'open_to_partner' THEN
    NEW.visibility := 'visible';
  END IF;
  NEW.brings := NULLIF(btrim(left(coalesce(NEW.brings,''), 280)), '');
  NEW.needs := NULLIF(btrim(left(coalesce(NEW.needs,''), 280)), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tender_intents_validate
BEFORE INSERT OR UPDATE ON public.tender_intents
FOR EACH ROW EXECUTE FUNCTION public.tender_intents_validate();

-- Upsert own intent
CREATE OR REPLACE FUNCTION public.set_tender_intent(
  p_tender_id uuid,
  p_intent text,
  p_visibility text DEFAULT 'visible',
  p_brings text DEFAULT NULL,
  p_needs text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.tender_intents;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  INSERT INTO public.tender_intents (tender_id, member_id, intent, visibility, brings, needs, active)
  VALUES (p_tender_id, v_uid, p_intent, coalesce(p_visibility,'visible'), p_brings, p_needs, true)
  ON CONFLICT (tender_id, member_id) DO UPDATE
    SET intent = EXCLUDED.intent,
        visibility = EXCLUDED.visibility,
        brings = EXCLUDED.brings,
        needs = EXCLUDED.needs,
        active = true
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'intent', v_row.intent, 'visibility', v_row.visibility,
    'brings', v_row.brings, 'needs', v_row.needs, 'active', v_row.active);
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_tender_intent(p_tender_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.tender_intents SET active = false
   WHERE tender_id = p_tender_id AND member_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'active', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_tender_intent(p_tender_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(x) FROM (
    SELECT intent, visibility, brings, needs, active
    FROM public.tender_intents
    WHERE tender_id = p_tender_id AND member_id = auth.uid()
  ) x;
$$;

-- Public counts (no identities at all)
CREATE OR REPLACE FUNCTION public.tender_intent_counts(p_tender_ids uuid[])
RETURNS TABLE (tender_id uuid, pursuing_count integer, open_to_partner_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ti.tender_id,
         count(*)::int AS pursuing_count,
         count(*) FILTER (WHERE ti.intent = 'open_to_partner')::int AS open_to_partner_count
  FROM public.tender_intents ti
  WHERE ti.active AND ti.tender_id = ANY(p_tender_ids)
  GROUP BY ti.tender_id;
$$;

-- Only open_to_partner members are ever individually revealed
CREATE OR REPLACE FUNCTION public.tender_open_partners(p_tender_id uuid)
RETURNS TABLE (member_id uuid, full_name text, brings text, needs text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ti.member_id, m.full_name, ti.brings, ti.needs, ti.created_at
  FROM public.tender_intents ti
  JOIN public.members m ON m.id = ti.member_id
  WHERE ti.tender_id = p_tender_id
    AND ti.active
    AND ti.intent = 'open_to_partner'
  ORDER BY ti.created_at ASC;
$$;

-- Admin analytics
CREATE OR REPLACE FUNCTION public.admin_tender_intent_analytics(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
        'total_intents', count(*),
        'active_intents', count(*) FILTER (WHERE active),
        'withdrawn_intents', count(*) FILTER (WHERE NOT active),
        'solo', count(*) FILTER (WHERE active AND intent = 'solo'),
        'solo_private', count(*) FILTER (WHERE active AND intent = 'solo' AND visibility = 'private'),
        'open_to_partner', count(*) FILTER (WHERE active AND intent = 'open_to_partner'),
        'distinct_members', count(DISTINCT member_id),
        'distinct_tenders', count(DISTINCT tender_id)
      ) FROM public.tender_intents),
    'top_open_to_partner', coalesce((
      SELECT jsonb_agg(t) FROM (
        SELECT ti.tender_id,
               td.ocid,
               coalesce(td.description, td.title) AS tender_title,
               td.buyer_name, td.province, td.closing_at,
               count(*) FILTER (WHERE ti.intent = 'open_to_partner')::int AS open_to_partner_count,
               count(*)::int AS pursuing_count
        FROM public.tender_intents ti
        JOIN public.tenders td ON td.id = ti.tender_id
        WHERE ti.active
        GROUP BY ti.tender_id, td.ocid, td.description, td.title, td.buyer_name, td.province, td.closing_at
        HAVING count(*) FILTER (WHERE ti.intent = 'open_to_partner') > 0
        ORDER BY open_to_partner_count DESC, pursuing_count DESC
        LIMIT greatest(1, coalesce(p_limit, 20))
      ) t), '[]'::jsonb),
    'top_pursued', coalesce((
      SELECT jsonb_agg(t) FROM (
        SELECT ti.tender_id,
               td.ocid,
               coalesce(td.description, td.title) AS tender_title,
               td.closing_at,
               count(*)::int AS pursuing_count,
               count(*) FILTER (WHERE ti.intent = 'open_to_partner')::int AS open_to_partner_count
        FROM public.tender_intents ti
        JOIN public.tenders td ON td.id = ti.tender_id
        WHERE ti.active
        GROUP BY ti.tender_id, td.ocid, td.description, td.title, td.closing_at
        ORDER BY pursuing_count DESC
        LIMIT greatest(1, coalesce(p_limit, 20))
      ) t), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tender_intent_analytics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_tender_intent(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_tender_intent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_tender_intent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tender_intent_counts(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tender_open_partners(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tender_intent_analytics(integer) TO authenticated;
