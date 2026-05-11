
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL DEFAULT
    '{"circle": true, "spark_trade": true, "marketing": true, "weekly_digest": true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  recipient_member uuid REFERENCES public.members(id) ON DELETE SET NULL,
  template text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  retry_count int NOT NULL DEFAULT 0,
  retried_at timestamptz,
  resend_id text,
  blast_id uuid,
  sent_by uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON public.email_log(status);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read email log" ON public.email_log;
CREATE POLICY "admins read email log" ON public.email_log FOR SELECT
  USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins insert email log" ON public.email_log;
CREATE POLICY "admins insert email log" ON public.email_log FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins update email log" ON public.email_log;
CREATE POLICY "admins update email log" ON public.email_log FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.email_blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body_html text NOT NULL,
  audience text NOT NULL,
  audience_filter jsonb,
  recipient_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.email_blasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage blasts" ON public.email_blasts;
CREATE POLICY "admins manage blasts" ON public.email_blasts FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_email_recipients(
  _audience text,
  _tier text DEFAULT NULL,
  _ids uuid[] DEFAULT NULL
)
RETURNS TABLE(id uuid, email text, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _audience = 'all' THEN
    RETURN QUERY SELECT m.id, m.email, m.full_name FROM public.members m
      WHERE m.email IS NOT NULL AND COALESCE(m.email_preferences->>'marketing','true') = 'true';
  ELSIF _audience = 'circle' THEN
    RETURN QUERY SELECT DISTINCT m.id, m.email, m.full_name FROM public.members m
      JOIN public.circle_bids b ON b.member_id = m.id
      WHERE m.email IS NOT NULL AND COALESCE(m.email_preferences->>'circle','true') = 'true';
  ELSIF _audience = 'buyers_club' THEN
    RETURN QUERY SELECT m.id, m.email, m.full_name FROM public.members m
      WHERE m.email IS NOT NULL
        AND COALESCE(m.has_buyers_club_access,false) = true
        AND COALESCE(m.email_preferences->>'spark_trade','true') = 'true';
  ELSIF _audience = 'tier' AND _tier IS NOT NULL THEN
    RETURN QUERY SELECT DISTINCT m.id, m.email, m.full_name FROM public.members m
      JOIN public.circle_bids b ON b.member_id = m.id
      WHERE b.tier = _tier AND m.email IS NOT NULL
        AND COALESCE(m.email_preferences->>'circle','true') = 'true';
  ELSIF _audience = 'custom' AND _ids IS NOT NULL THEN
    RETURN QUERY SELECT m.id, m.email, m.full_name FROM public.members m
      WHERE m.id = ANY(_ids) AND m.email IS NOT NULL;
  END IF;
END $$;
