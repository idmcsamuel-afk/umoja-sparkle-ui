
-- 1. Drop overly-permissive vault queue policy that exposed all columns of vault bids to every authenticated user.
DROP POLICY IF EXISTS "Authenticated members can view active vault queue bids" ON public.circle_bids;

-- 2. Provide SECURITY DEFINER helpers that expose ONLY safe columns of the public vault queue.
CREATE OR REPLACE FUNCTION public.get_vault_queue(_tier text, _limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  member_id uuid,
  fiat_amount numeric,
  tier text,
  status text,
  created_at timestamptz,
  vault_start timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, member_id, fiat_amount, tier, status, created_at, vault_start
  FROM public.circle_bids
  WHERE tier = _tier
    AND status = 'vault'
    AND vault_start IS NOT NULL
  ORDER BY created_at ASC
  LIMIT GREATEST(COALESCE(_limit, 10), 0);
$$;

CREATE OR REPLACE FUNCTION public.get_vault_queue_count(_tier text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.circle_bids
  WHERE tier = _tier
    AND status = 'vault'
    AND vault_start IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_vault_queue_position(_tier text, _created_at timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.circle_bids
  WHERE tier = _tier
    AND status = 'vault'
    AND vault_start IS NOT NULL
    AND created_at < _created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_vault_queue(text, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vault_queue_count(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_vault_queue_position(text, timestamptz) TO authenticated, anon;

-- 3. Pin search_path on the two flagged helper functions.
CREATE OR REPLACE FUNCTION public._gen_withdrawal_ref()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
BEGIN
  LOOP
    result := 'UMOJA-';
    FOR i IN 1..8 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.withdrawal_requests WHERE reference_number = result);
  END LOOP;
  RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public._promo_unlock_bonus(_fiat numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN _fiat >= 1001 THEN 200
    WHEN _fiat >= 501 THEN 75
    WHEN _fiat >= 100 THEN 10
    WHEN _fiat >= 50 THEN 5
    ELSE 0
  END::numeric;
$function$;
