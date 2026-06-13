
CREATE OR REPLACE FUNCTION public.allocate_circle_payouts()
RETURNS TABLE (allocated_count INT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allocated INT := 0;
  v_error TEXT := NULL;
BEGIN
  WITH bids_to_allocate AS (
    SELECT cb.id,
           cb.created_at AS new_vault_start,
           cb.created_at + (ct.vault_days || ' days')::interval AS new_vault_end
    FROM public.circle_bids cb
    JOIN public.circle_tiers ct ON ct.tier = cb.tier
    WHERE cb.status = 'active'
      AND cb.vault_start IS NULL
  ),
  upd AS (
    UPDATE public.circle_bids cb
       SET status = 'vault',
           vault_start = bta.new_vault_start,
           vault_end   = bta.new_vault_end,
           allocated_at = COALESCE(cb.allocated_at, now()),
           updated_at  = now()
      FROM bids_to_allocate bta
     WHERE cb.id = bta.id
    RETURNING cb.id
  )
  SELECT COUNT(*)::int INTO v_allocated FROM upd;

  INSERT INTO public.admin_audit_log (actor_id, action, details)
    VALUES (NULL, 'allocate_circle_payouts',
            jsonb_build_object('allocated_count', v_allocated, 'timestamp', now()));

  RETURN QUERY SELECT v_allocated, v_error;

EXCEPTION WHEN OTHERS THEN
  v_error := SQLERRM;
  INSERT INTO public.admin_audit_log (actor_id, action, details)
    VALUES (NULL, 'allocate_circle_payouts_ERROR',
            jsonb_build_object('error', v_error, 'timestamp', now()));
  RETURN QUERY SELECT 0, v_error;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_circle_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_circle_payouts() TO service_role;
