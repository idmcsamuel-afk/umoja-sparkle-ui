
CREATE OR REPLACE FUNCTION public.kyc_verified_referral_sparks(_member uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND m.kyc_status IN ('approved','verified')
    AND public.qualifying_contribution_zar(m.id) > 0;
$function$;

CREATE OR REPLACE FUNCTION public.releasable_referral_sparks(_member uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH w AS (
    SELECT COALESCE(referral_balance, 0) AS bal,
           COALESCE(referral_sparks_withdrawn, 0) AS used
      FROM public.spark_wallets WHERE member_id = _member
  )
  SELECT LEAST(
    GREATEST( floor(public.qualifying_contribution_zar(_member) / 3.0) - w.used, 0 ),
    GREATEST( public.kyc_verified_referral_sparks(_member) - w.used, 0 ),
    w.bal
  ) FROM w;
$function$;
