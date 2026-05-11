
CREATE OR REPLACE FUNCTION public.my_referred_members()
RETURNS TABLE(id uuid, full_name text, joined_at timestamptz, kyc_level integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT referral_code FROM public.members WHERE id = auth.uid())
  SELECT m.id, m.full_name, m.created_at, m.kyc_level
    FROM public.members m, me
   WHERE m.referred_by = auth.uid()
      OR (me.referral_code IS NOT NULL AND m.referred_by_code = me.referral_code)
   ORDER BY m.created_at DESC
   LIMIT 200;
$$;
