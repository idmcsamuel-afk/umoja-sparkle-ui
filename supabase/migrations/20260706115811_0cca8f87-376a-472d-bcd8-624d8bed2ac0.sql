
CREATE TABLE public.email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text,
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  unsubscribed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.email_unsubscribes TO anon;
GRANT SELECT, INSERT ON public.email_unsubscribes TO authenticated;
GRANT ALL ON public.email_unsubscribes TO service_role;

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert an unsubscribe record (one-click)
CREATE POLICY "anyone_can_unsubscribe"
  ON public.email_unsubscribes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read the list
CREATE POLICY "admins_view_unsubscribes"
  ON public.email_unsubscribes
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes (lower(email));
