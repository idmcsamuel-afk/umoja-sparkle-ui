CREATE OR REPLACE FUNCTION public.tender_intent_counts(p_tender_ids uuid[])
 RETURNS TABLE(tender_id uuid, pursuing_count integer, open_to_partner_count integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ti.tender_id,
         count(*) FILTER (WHERE ti.intent = 'solo')::int AS pursuing_count,
         count(*) FILTER (WHERE ti.intent = 'open_to_partner')::int AS open_to_partner_count
  FROM public.tender_intents ti
  WHERE ti.active AND ti.tender_id = ANY(p_tender_ids)
  GROUP BY ti.tender_id;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tender_intent_analytics(p_limit integer DEFAULT 20)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
               count(*) FILTER (WHERE ti.intent = 'solo')::int AS pursuing_count
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
               td.buyer_name, td.province, td.closing_at,
               count(*) FILTER (WHERE ti.intent = 'solo')::int AS pursuing_count,
               count(*) FILTER (WHERE ti.intent = 'open_to_partner')::int AS open_to_partner_count
        FROM public.tender_intents ti
        JOIN public.tenders td ON td.id = ti.tender_id
        WHERE ti.active
        GROUP BY ti.tender_id, td.ocid, td.description, td.title, td.buyer_name, td.province, td.closing_at
        ORDER BY (count(*) FILTER (WHERE ti.intent = 'solo')) DESC, open_to_partner_count DESC
        LIMIT greatest(1, coalesce(p_limit, 20))
      ) t), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_tender_intent_parties(p_tender_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT jsonb_build_object(
    'tender', (SELECT jsonb_build_object(
        'id', td.id, 'ocid', td.ocid,
        'title', coalesce(td.description, td.title),
        'buyer_name', td.buyer_name, 'province', td.province,
        'closing_at', td.closing_at)
      FROM public.tenders td WHERE td.id = p_tender_id),
    'open_to_partner', coalesce((
      SELECT jsonb_agg(x ORDER BY x.created_at) FROM (
        SELECT ti.member_id,
               NULLIF(TRIM(m.full_name), '') AS full_name,
               NULLIF(TRIM(m.province), '') AS province,
               ti.brings, ti.needs,
               coalesce(ti.brings_tags, '{}'::text[]) AS brings_tags,
               coalesce(ti.needs_tags, '{}'::text[]) AS needs_tags,
               ti.created_at
        FROM public.tender_intents ti
        JOIN public.members m ON m.id = ti.member_id
        WHERE ti.tender_id = p_tender_id AND ti.active AND ti.intent = 'open_to_partner'
      ) x), '[]'::jsonb),
    'solo_visible', coalesce((
      SELECT jsonb_agg(x ORDER BY x.created_at) FROM (
        SELECT ti.member_id,
               NULLIF(TRIM(m.full_name), '') AS full_name,
               NULLIF(TRIM(m.province), '') AS province,
               ti.created_at
        FROM public.tender_intents ti
        JOIN public.members m ON m.id = ti.member_id
        WHERE ti.tender_id = p_tender_id AND ti.active
          AND ti.intent = 'solo' AND ti.visibility = 'visible'
      ) x), '[]'::jsonb),
    'solo_private_count', (
      SELECT count(*)::int FROM public.tender_intents ti
      WHERE ti.tender_id = p_tender_id AND ti.active
        AND ti.intent = 'solo' AND ti.visibility = 'private')
  ) INTO v;

  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_tender_intent_parties(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tender_intent_parties(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_tenders()
 RETURNS TABLE(
   id uuid, ocid text, title text, description text, buyer_name text, province text,
   closing_at timestamptz, value_amount numeric, value_currency text, category text,
   unlocked boolean, fit_checked boolean, intent text, intent_visibility text,
   last_activity_at timestamptz
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  acts AS (
    SELECT tu.tender_id,
           bool_or(tu.unlock_type = 'reveal') AS unlocked,
           max(tu.created_at) AS at
    FROM public.tender_unlocks tu, me
    WHERE tu.member_id = me.uid GROUP BY tu.tender_id
  ),
  fits AS (
    SELECT ao.tender_id, max(ao.created_at) AS at
    FROM public.tender_ai_outputs ao, me
    WHERE ao.member_id = me.uid GROUP BY ao.tender_id
  ),
  ints AS (
    SELECT ti.tender_id, ti.intent, ti.visibility, ti.updated_at AS at
    FROM public.tender_intents ti, me
    WHERE ti.member_id = me.uid AND ti.active
  ),
  ids AS (
    SELECT tender_id FROM acts
    UNION SELECT tender_id FROM fits
    UNION SELECT tender_id FROM ints
  )
  SELECT td.id, td.ocid, td.title, td.description, td.buyer_name, td.province,
         td.closing_at, td.value_amount, td.value_currency, td.category,
         coalesce(a.unlocked, false) AS unlocked,
         (f.tender_id IS NOT NULL) AS fit_checked,
         i.intent, i.visibility AS intent_visibility,
         greatest(coalesce(a.at, 'epoch'::timestamptz), coalesce(f.at, 'epoch'::timestamptz), coalesce(i.at, 'epoch'::timestamptz)) AS last_activity_at
  FROM ids
  JOIN public.tenders td ON td.id = ids.tender_id
  LEFT JOIN acts a ON a.tender_id = ids.tender_id
  LEFT JOIN fits f ON f.tender_id = ids.tender_id
  LEFT JOIN ints i ON i.tender_id = ids.tender_id
  ORDER BY last_activity_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.my_tenders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tenders() TO authenticated, service_role;