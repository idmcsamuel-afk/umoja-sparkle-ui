-- 1) Allow first-time referrer assignment (only block changes once already set)
CREATE OR REPLACE FUNCTION public.protect_privileged_member_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  NEW.kyc_status := OLD.kyc_status;
  NEW.rank := OLD.rank;
  -- Allow first-time assignment of referred_by; block changes once set.
  IF OLD.referred_by IS NOT NULL THEN
    NEW.referred_by := OLD.referred_by;
  END IF;
  RETURN NEW;
END $$;

-- 2) Backfill referred_by from referred_by_code for existing rows
UPDATE public.members m
   SET referred_by = r.id
  FROM public.members r
 WHERE m.referred_by IS NULL
   AND m.referred_by_code IS NOT NULL
   AND r.referral_code = m.referred_by_code
   AND r.id <> m.id;

-- 3) Count referrals via either link
CREATE OR REPLACE FUNCTION public.referral_stats(_member uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_refs bigint, sparks_earned numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH me AS (
    SELECT id, referral_code FROM public.members
     WHERE id = COALESCE(_member, auth.uid())
  )
  SELECT
    (SELECT COUNT(*) FROM public.members m, me
      WHERE m.id <> me.id
        AND (m.referred_by = me.id
             OR (me.referral_code IS NOT NULL AND m.referred_by_code = me.referral_code))),
    COALESCE((SELECT SUM(amount) FROM public.spark_transactions, me
               WHERE to_member = me.id
                 AND tx_type IN ('referral_signup','referral_kyc_bonus')), 0);
$$;

CREATE OR REPLACE FUNCTION public.referral_leaderboard(_limit integer DEFAULT 10)
 RETURNS TABLE(member_id uuid, full_name text, referral_code text, total_refs bigint, sparks_earned numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT m.id,
         COALESCE(m.full_name,'Member') AS full_name,
         m.referral_code,
         (SELECT COUNT(*) FROM public.members r
           WHERE r.id <> m.id
             AND (r.referred_by = m.id
                  OR (m.referral_code IS NOT NULL AND r.referred_by_code = m.referral_code)))::bigint AS total_refs,
         COALESCE((SELECT SUM(amount) FROM public.spark_transactions
                    WHERE to_member = m.id
                      AND tx_type IN ('referral_signup','referral_kyc_bonus')), 0) AS sparks_earned
    FROM public.members m
   WHERE EXISTS (
      SELECT 1 FROM public.members r
       WHERE r.id <> m.id
         AND (r.referred_by = m.id
              OR (m.referral_code IS NOT NULL AND r.referred_by_code = m.referral_code))
   )
   ORDER BY total_refs DESC, sparks_earned DESC
   LIMIT GREATEST(1, LEAST(_limit, 100));
$$;