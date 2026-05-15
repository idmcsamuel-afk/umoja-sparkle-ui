
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subs_member_idx ON public.push_subscriptions(member_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subs_own_all" ON public.push_subscriptions;
CREATE POLICY "push_subs_own_all"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "push_subs_admin_select" ON public.push_subscriptions;
CREATE POLICY "push_subs_admin_select"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS delivery_stats jsonb NOT NULL DEFAULT '{}'::jsonb;
