
-- 1) SECURITY DEFINER VIEW fix: switch to invoker semantics
ALTER VIEW public.v_products_pending_supplier SET (security_invoker = true);
ALTER VIEW public.v_products_ready_to_publish SET (security_invoker = true);

-- 2) fulfillment_applications: nullify bank fields after admin decision
CREATE OR REPLACE FUNCTION public.fa_clear_bank_on_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(coalesce(NEW.status,'')) IN ('approved','rejected','withdrawn','cancelled') THEN
    NEW.account_number := NULL;
    NEW.branch_code := NULL;
    NEW.bank_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fa_clear_bank_on_decision ON public.fulfillment_applications;
CREATE TRIGGER trg_fa_clear_bank_on_decision
BEFORE UPDATE ON public.fulfillment_applications
FOR EACH ROW EXECUTE FUNCTION public.fa_clear_bank_on_decision();

-- 3) withdrawal_requests: nullify bank fields when withdrawal reaches final state
CREATE OR REPLACE FUNCTION public.wr_clear_bank_on_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND lower(coalesce(NEW.status,'')) IN ('completed','paid','rejected','failed','cancelled') THEN
    NEW.account_number := NULL;
    NEW.account_holder := NULL;
    NEW.branch_code := NULL;
    NEW.bank_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wr_clear_bank_on_final ON public.withdrawal_requests;
CREATE TRIGGER trg_wr_clear_bank_on_final
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.wr_clear_bank_on_final();

-- 4) members table: defense-in-depth — ensure anon can never read PII even if
-- a future permissive policy is added. Authenticated access still gated by RLS.
REVOKE SELECT ON public.members FROM anon;
REVOKE SELECT ON public.members FROM PUBLIC;

-- 5) spark_trade_subscriptions: revoke any anon access to redundant contact
-- columns; access remains owner/admin only via RLS for authenticated.
REVOKE SELECT ON public.spark_trade_subscriptions FROM anon;
REVOKE SELECT ON public.spark_trade_subscriptions FROM PUBLIC;
