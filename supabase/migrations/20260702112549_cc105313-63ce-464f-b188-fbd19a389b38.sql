
-- Tie referral spark withdrawals to KYC status of referred users
-- Prevents farming by creating fake signups without KYC verification.

CREATE OR REPLACE FUNCTION public.kyc_verified_referral_sparks(_member uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(st.amount), 0)
  FROM public.spark_transactions st
  JOIN public.members m ON m.id = st.from_member
  WHERE st.to_member = _member
    AND st.status = 'completed'
    AND st.tx_type IN (
      'referral_signup',
      'referral_kyc_bonus',
      'referral_bonus',
      'referral_admin_bonus'
    )
    AND m.kyc_level >= 3
    AND m.kyc_status IN ('approved','verified');
$$;

GRANT EXECUTE ON FUNCTION public.kyc_verified_referral_sparks(uuid) TO authenticated, service_role;

-- Cap releasable referral sparks by (a) wallet balance, (b) own-contribution ratio,
-- AND (c) referral sparks that came from KYC-verified referred members.
CREATE OR REPLACE FUNCTION public.releasable_referral_sparks(_member uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH w AS (
    SELECT COALESCE(referral_balance, 0) AS bal,
           COALESCE(referral_sparks_withdrawn, 0) AS used
      FROM public.spark_wallets WHERE member_id = _member
  )
  SELECT LEAST(
    GREATEST( floor(public.qualifying_contribution_zar(_member) / 1.5) - w.used, 0 ),
    GREATEST( public.kyc_verified_referral_sparks(_member) - w.used, 0 ),
    w.bal
  ) FROM w;
$$;
