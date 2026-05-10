-- Activate harvest tier so all three circles render
UPDATE public.circle_tiers SET is_active = true WHERE tier = 'harvest';

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  kind text DEFAULT 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = member_id);

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);

CREATE POLICY "notifications_insert_self" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notifications_member_unread
  ON public.notifications(member_id, read_at);
