
-- 1) bank_accounts: drop the blanket authenticated read, add a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "bank_accounts auth read" ON public.bank_accounts;

CREATE OR REPLACE FUNCTION public.get_active_bank_account(_project text)
RETURNS TABLE (
  id uuid,
  bank_name text,
  account_name text,
  account_holder text,
  account_number text,
  branch_code text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _project NOT IN ('circle','spark_trade','property','drive','buyers_club') THEN
    RAISE EXCEPTION 'invalid project';
  END IF;

  RETURN QUERY
  SELECT b.id, b.bank_name, b.account_name, b.account_holder, b.account_number, b.branch_code
    FROM public.bank_accounts b
   WHERE b.is_active = true
     AND CASE _project
           WHEN 'circle'      THEN b.for_circle
           WHEN 'spark_trade' THEN b.for_spark_trade
           WHEN 'property'    THEN b.for_property
           WHEN 'drive'       THEN b.for_drive
           WHEN 'buyers_club' THEN b.for_buyers_club
         END = true
   ORDER BY b.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT b.id, b.bank_name, b.account_name, b.account_holder, b.account_number, b.branch_code
      FROM public.bank_accounts b
     WHERE b.is_active = true AND b.is_default = true
     ORDER BY b.created_at DESC
     LIMIT 1;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_active_bank_account(text) TO authenticated;

-- 2) spark_trade_joins: drop overly permissive public select
DROP POLICY IF EXISTS "stj_select" ON public.spark_trade_joins;

-- 3) waitlist: prevent duplicate/spam submissions
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique ON public.waitlist (lower(email));
