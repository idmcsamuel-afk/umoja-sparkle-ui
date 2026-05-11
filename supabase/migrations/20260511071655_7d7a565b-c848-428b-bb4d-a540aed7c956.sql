
CREATE TABLE public.admin_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid,
  uses_remaining integer NOT NULL DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_invites_admin_all"
  ON public.admin_invite_codes
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow anonymous validation (read-only) so signup form can check code
CREATE POLICY "admin_invites_public_validate"
  ON public.admin_invite_codes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Atomic redeem function callable by anon (used right after signup)
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  UPDATE public.admin_invite_codes
     SET uses_remaining = uses_remaining - 1
   WHERE code = _code
     AND uses_remaining > 0
     AND (expires_at IS NULL OR expires_at > now())
   RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END $$;

GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO anon, authenticated;
