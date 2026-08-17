-- ============ TENDER SYNDICATES (Stage A: formation + coordination room) ============
-- Entirely separate from savings-circle bids. No money, no Sparks, no fees.

CREATE TABLE public.tender_syndicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  originator_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name text,
  status text NOT NULL DEFAULT 'forming',
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tender_syndicates_status_chk CHECK (status IN ('forming','closed','withdrawn')),
  CONSTRAINT tender_syndicates_one_per_originator UNIQUE (tender_id, originator_id)
);

CREATE TABLE public.tender_syndicate_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id uuid NOT NULL REFERENCES public.tender_syndicates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'invited',
  brings_tags text[] NOT NULL DEFAULT '{}'::text[],
  brings_note text,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tsm_role_chk CHECK (role IN ('originator','member')),
  CONSTRAINT tsm_status_chk CHECK (status IN ('invited','applied','accepted','declined','removed')),
  CONSTRAINT tsm_note_len CHECK (brings_note IS NULL OR char_length(brings_note) <= 280),
  CONSTRAINT tsm_unique UNIQUE (syndicate_id, member_id)
);

CREATE TABLE public.tender_syndicate_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id uuid NOT NULL REFERENCES public.tender_syndicates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tender_syndicate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id uuid NOT NULL REFERENCES public.tender_syndicates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  file_ref text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ts_tender ON public.tender_syndicates(tender_id);
CREATE INDEX idx_tsm_syndicate ON public.tender_syndicate_members(syndicate_id);
CREATE INDEX idx_tsm_member ON public.tender_syndicate_members(member_id);
CREATE INDEX idx_tsmsg_syndicate ON public.tender_syndicate_messages(syndicate_id, created_at);
CREATE INDEX idx_tsdoc_syndicate ON public.tender_syndicate_documents(syndicate_id, created_at);

-- Grants: all writes go through SECURITY DEFINER RPCs; direct reads stay RLS-gated.
GRANT SELECT ON public.tender_syndicates TO authenticated;
GRANT SELECT ON public.tender_syndicate_members TO authenticated;
GRANT SELECT ON public.tender_syndicate_messages TO authenticated;
GRANT SELECT ON public.tender_syndicate_documents TO authenticated;
GRANT ALL ON public.tender_syndicates TO service_role;
GRANT ALL ON public.tender_syndicate_members TO service_role;
GRANT ALL ON public.tender_syndicate_messages TO service_role;
GRANT ALL ON public.tender_syndicate_documents TO service_role;

ALTER TABLE public.tender_syndicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_syndicate_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_syndicate_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_syndicate_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tender_syndicate_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_ts_touch BEFORE UPDATE ON public.tender_syndicates
FOR EACH ROW EXECUTE FUNCTION public.tender_syndicate_touch();
CREATE TRIGGER trg_tsm_touch BEFORE UPDATE ON public.tender_syndicate_members
FOR EACH ROW EXECUTE FUNCTION public.tender_syndicate_touch();

-- ---------- membership helpers ----------
CREATE OR REPLACE FUNCTION public.is_syndicate_member(_syndicate_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tender_syndicates s
    WHERE s.id = _syndicate_id AND s.originator_id = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.tender_syndicate_members m
    WHERE m.syndicate_id = _syndicate_id AND m.member_id = _uid AND m.status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_syndicate_originator(_syndicate_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tender_syndicates s
    WHERE s.id = _syndicate_id AND s.originator_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.syndicates_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT enabled FROM public.tender_feature_flags WHERE key = 'tender_syndicates_enabled'), false);
$$;

-- ---------- RLS: read access only for room members (or admin) ----------
CREATE POLICY ts_select_members ON public.tender_syndicates FOR SELECT TO authenticated
USING (originator_id = auth.uid()
  OR public.is_syndicate_member(id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.tender_syndicate_members m
             WHERE m.syndicate_id = id AND m.member_id = auth.uid())
  OR public.is_admin(auth.uid()));

CREATE POLICY tsm_select_members ON public.tender_syndicate_members FOR SELECT TO authenticated
USING (member_id = auth.uid()
  OR public.is_syndicate_member(syndicate_id, auth.uid())
  OR public.is_admin(auth.uid()));

CREATE POLICY tsmsg_select_members ON public.tender_syndicate_messages FOR SELECT TO authenticated
USING (public.is_syndicate_member(syndicate_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY tsdoc_select_members ON public.tender_syndicate_documents FOR SELECT TO authenticated
USING (public.is_syndicate_member(syndicate_id, auth.uid()) OR public.is_admin(auth.uid()));

-- ---------- storage: private docs bucket, syndicate members only ----------
CREATE POLICY tender_syndicate_docs_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tender-syndicate-docs'
  AND public.is_syndicate_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY tender_syndicate_docs_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tender-syndicate-docs'
  AND public.is_syndicate_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY tender_syndicate_docs_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tender-syndicate-docs' AND owner = auth.uid());

-- ---------- RPCs ----------
CREATE OR REPLACE FUNCTION public.open_tender_syndicate(p_tender_id uuid, p_name text DEFAULT NULL, p_summary text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_title text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.syndicates_enabled() THEN RAISE EXCEPTION 'syndicates_disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tender_unlocks u
                 WHERE u.tender_id = p_tender_id AND u.member_id = v_uid AND u.unlock_type = 'reveal') THEN
    RAISE EXCEPTION 'tender_not_unlocked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tender_intents ti
                 WHERE ti.tender_id = p_tender_id AND ti.member_id = v_uid AND ti.active) THEN
    RAISE EXCEPTION 'intent_required';
  END IF;

  SELECT coalesce(NULLIF(TRIM(t.description), ''), t.title) INTO v_title FROM public.tenders t WHERE t.id = p_tender_id;

  INSERT INTO public.tender_syndicates (tender_id, originator_id, name, summary)
  VALUES (p_tender_id, v_uid, coalesce(NULLIF(TRIM(p_name), ''), left(coalesce(v_title,'Syndicate'), 120)), NULLIF(TRIM(p_summary), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.tender_syndicate_members (syndicate_id, member_id, role, status, joined_at)
  VALUES (v_id, v_uid, 'originator', 'accepted', now());

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_tender_syndicate_status(p_syndicate_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_syndicate_originator(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_originator'; END IF;
  IF p_status NOT IN ('forming','closed','withdrawn') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.tender_syndicates SET status = p_status WHERE id = p_syndicate_id;
END $$;

CREATE OR REPLACE FUNCTION public.invite_to_tender_syndicate(p_syndicate_id uuid, p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tender uuid;
BEGIN
  IF NOT public.is_syndicate_originator(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_originator'; END IF;
  SELECT tender_id INTO v_tender FROM public.tender_syndicates WHERE id = p_syndicate_id AND status = 'forming';
  IF v_tender IS NULL THEN RAISE EXCEPTION 'syndicate_not_forming'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tender_intents ti
                 WHERE ti.tender_id = v_tender AND ti.member_id = p_member_id
                   AND ti.active AND ti.intent = 'open_to_partner') THEN
    RAISE EXCEPTION 'member_not_open_to_partner';
  END IF;
  INSERT INTO public.tender_syndicate_members AS tsm (syndicate_id, member_id, role, status)
  VALUES (p_syndicate_id, p_member_id, 'member', 'invited')
  ON CONFLICT (syndicate_id, member_id) DO UPDATE
    SET status = CASE WHEN tsm.status IN ('declined','removed') THEN 'invited' ELSE tsm.status END;
END $$;

CREATE OR REPLACE FUNCTION public.apply_to_tender_syndicate(p_syndicate_id uuid, p_brings_tags text[] DEFAULT '{}'::text[], p_brings_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.syndicates_enabled() THEN RAISE EXCEPTION 'syndicates_disabled'; END IF;
  SELECT status INTO v_status FROM public.tender_syndicates WHERE id = p_syndicate_id;
  IF v_status IS DISTINCT FROM 'forming' THEN RAISE EXCEPTION 'syndicate_not_forming'; END IF;
  IF public.is_syndicate_originator(p_syndicate_id, v_uid) THEN RAISE EXCEPTION 'already_originator'; END IF;

  INSERT INTO public.tender_syndicate_members AS tsm (syndicate_id, member_id, role, status, brings_tags, brings_note, joined_at)
  VALUES (p_syndicate_id, v_uid, 'member',
          CASE WHEN EXISTS (SELECT 1 FROM public.tender_syndicate_members x
                            WHERE x.syndicate_id = p_syndicate_id AND x.member_id = v_uid AND x.status = 'invited')
               THEN 'accepted' ELSE 'applied' END,
          coalesce(p_brings_tags, '{}'::text[]), left(NULLIF(TRIM(p_brings_note), ''), 280), NULL)
  ON CONFLICT (syndicate_id, member_id) DO UPDATE
    SET brings_tags = coalesce(EXCLUDED.brings_tags, '{}'::text[]),
        brings_note = EXCLUDED.brings_note,
        status = CASE WHEN tsm.status IN ('invited','accepted') THEN 'accepted' ELSE 'applied' END,
        joined_at = CASE WHEN tsm.status IN ('invited','accepted') THEN coalesce(tsm.joined_at, now()) ELSE NULL END;
END $$;

CREATE OR REPLACE FUNCTION public.respond_tender_syndicate_member(p_syndicate_id uuid, p_member_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_syndicate_originator(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_originator'; END IF;
  IF p_member_id = auth.uid() THEN RAISE EXCEPTION 'cannot_target_originator'; END IF;
  IF p_action = 'accept' THEN
    UPDATE public.tender_syndicate_members SET status = 'accepted', joined_at = coalesce(joined_at, now())
    WHERE syndicate_id = p_syndicate_id AND member_id = p_member_id;
  ELSIF p_action = 'decline' THEN
    UPDATE public.tender_syndicate_members SET status = 'declined', joined_at = NULL
    WHERE syndicate_id = p_syndicate_id AND member_id = p_member_id;
  ELSIF p_action = 'remove' THEN
    UPDATE public.tender_syndicate_members SET status = 'removed', joined_at = NULL
    WHERE syndicate_id = p_syndicate_id AND member_id = p_member_id;
  ELSE RAISE EXCEPTION 'invalid_action';
  END IF;
END $$;

-- Listing for a tender: name, originator name, counts, my status. No notes, no contacts.
CREATE OR REPLACE FUNCTION public.tender_syndicates_for_tender(p_tender_id uuid)
RETURNS TABLE(id uuid, name text, status text, originator_id uuid, originator_name text,
              accepted_count integer, my_status text, is_originator boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.name, s.status, s.originator_id,
         NULLIF(TRIM(m.full_name), '')::text,
         (SELECT count(*)::int FROM public.tender_syndicate_members x
          WHERE x.syndicate_id = s.id AND x.status = 'accepted'),
         (SELECT y.status FROM public.tender_syndicate_members y
          WHERE y.syndicate_id = s.id AND y.member_id = auth.uid()),
         (s.originator_id = auth.uid()),
         s.created_at
  FROM public.tender_syndicates s
  JOIN public.members m ON m.id = s.originator_id
  WHERE s.tender_id = p_tender_id AND s.status <> 'withdrawn'
  ORDER BY s.created_at ASC;
$$;

-- The room. Members-only payload; non-members get NULL.
CREATE OR REPLACE FUNCTION public.get_tender_syndicate(p_syndicate_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_is_member boolean; v_is_orig boolean; v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  v_is_member := public.is_syndicate_member(p_syndicate_id, v_uid);
  v_is_orig := public.is_syndicate_originator(p_syndicate_id, v_uid);
  IF NOT v_is_member AND NOT v_is_orig THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id', s.id, 'name', s.name, 'status', s.status, 'summary', s.summary,
    'created_at', s.created_at, 'is_originator', v_is_orig,
    'tender', jsonb_build_object('id', t.id, 'title', t.title, 'description', t.description,
      'buyer_name', t.buyer_name, 'province', t.province, 'closing_at', t.closing_at,
      'value_amount', t.value_amount, 'value_currency', t.value_currency),
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', mm.member_id, 'full_name', NULLIF(TRIM(mem.full_name), ''),
        'province', NULLIF(TRIM(mem.province), ''), 'role', mm.role, 'status', mm.status,
        'brings_tags', mm.brings_tags, 'brings_note', mm.brings_note, 'joined_at', mm.joined_at
      ) ORDER BY mm.role DESC, mm.created_at ASC)
      FROM public.tender_syndicate_members mm
      JOIN public.members mem ON mem.id = mm.member_id
      WHERE mm.syndicate_id = s.id AND mm.status IN ('accepted','applied','invited')
    ), '[]'::jsonb)
  ) INTO v_out
  FROM public.tender_syndicates s
  JOIN public.tenders t ON t.id = s.tender_id
  WHERE s.id = p_syndicate_id;

  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION public.tender_syndicate_thread(p_syndicate_id uuid)
RETURNS TABLE(id uuid, member_id uuid, full_name text, body text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_syndicate_member(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_syndicate_member'; END IF;
  RETURN QUERY
    SELECT g.id, g.member_id, NULLIF(TRIM(m.full_name), '')::text, g.body, g.created_at
    FROM public.tender_syndicate_messages g
    JOIN public.members m ON m.id = g.member_id
    WHERE g.syndicate_id = p_syndicate_id
    ORDER BY g.created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.post_tender_syndicate_message(p_syndicate_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_syndicate_member(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_syndicate_member'; END IF;
  IF coalesce(TRIM(p_body), '') = '' THEN RAISE EXCEPTION 'empty_body'; END IF;
  INSERT INTO public.tender_syndicate_messages (syndicate_id, member_id, body)
  VALUES (p_syndicate_id, auth.uid(), left(TRIM(p_body), 4000)) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.tender_syndicate_docs(p_syndicate_id uuid)
RETURNS TABLE(id uuid, member_id uuid, full_name text, file_ref text, file_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_syndicate_member(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_syndicate_member'; END IF;
  RETURN QUERY
    SELECT d.id, d.member_id, NULLIF(TRIM(m.full_name), '')::text, d.file_ref, d.file_name, d.created_at
    FROM public.tender_syndicate_documents d
    JOIN public.members m ON m.id = d.member_id
    WHERE d.syndicate_id = p_syndicate_id
    ORDER BY d.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.add_tender_syndicate_document(p_syndicate_id uuid, p_file_ref text, p_file_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_syndicate_member(p_syndicate_id, auth.uid()) THEN RAISE EXCEPTION 'not_syndicate_member'; END IF;
  INSERT INTO public.tender_syndicate_documents (syndicate_id, member_id, file_ref, file_name)
  VALUES (p_syndicate_id, auth.uid(), p_file_ref, left(coalesce(NULLIF(TRIM(p_file_name),''),'document'), 200))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.my_tender_syndicates()
RETURNS TABLE(id uuid, name text, status text, tender_id uuid, tender_title text, closing_at timestamptz,
              role text, my_status text, accepted_count integer, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.name, s.status, s.tender_id,
         coalesce(NULLIF(TRIM(t.description), ''), t.title) AS tender_title,
         t.closing_at, mm.role, mm.status,
         (SELECT count(*)::int FROM public.tender_syndicate_members x
          WHERE x.syndicate_id = s.id AND x.status = 'accepted'),
         s.updated_at
  FROM public.tender_syndicate_members mm
  JOIN public.tender_syndicates s ON s.id = mm.syndicate_id
  JOIN public.tenders t ON t.id = s.tender_id
  WHERE mm.member_id = auth.uid() AND mm.status IN ('accepted','applied','invited')
  ORDER BY s.updated_at DESC;
$$;

INSERT INTO public.tender_feature_flags (key, enabled, description)
VALUES ('tender_syndicates_enabled', true, 'Tender Syndicate Stage A: formation + coordination room')
ON CONFLICT (key) DO UPDATE SET enabled = true, updated_at = now();