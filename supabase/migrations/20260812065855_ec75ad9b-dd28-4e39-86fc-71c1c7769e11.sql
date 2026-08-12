DROP FUNCTION IF EXISTS public.tender_open_partners(uuid);

CREATE OR REPLACE FUNCTION public.tender_open_partners(p_tender_id uuid)
RETURNS TABLE (
  member_id uuid,
  full_name text,
  province text,
  brings text,
  needs text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.member_id,
         NULLIF(TRIM(m.full_name), '')::text AS full_name,
         NULLIF(TRIM(m.province), '')::text AS province,
         ti.brings,
         ti.needs,
         ti.created_at
  FROM public.tender_intents ti
  JOIN public.members m ON m.id = ti.member_id
  WHERE ti.tender_id = p_tender_id
    AND ti.active
    AND ti.intent = 'open_to_partner'
  ORDER BY ti.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.tender_open_partners(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tender_open_partners(uuid) TO anon, authenticated, service_role;