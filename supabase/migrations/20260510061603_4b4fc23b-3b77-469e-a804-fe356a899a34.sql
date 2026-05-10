
CREATE TABLE IF NOT EXISTS public.drive_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  circle_id uuid NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email  boolean NOT NULL DEFAULT true,
  push   boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, circle_id)
);

ALTER TABLE public.drive_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dnp_select_own" ON public.drive_notification_prefs
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "dnp_insert_own" ON public.drive_notification_prefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "dnp_update_own" ON public.drive_notification_prefs
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);
CREATE POLICY "dnp_delete_own" ON public.drive_notification_prefs
  FOR DELETE TO authenticated USING (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS idx_dnp_circle ON public.drive_notification_prefs(circle_id);

CREATE OR REPLACE FUNCTION public.touch_drive_notification_prefs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_dnp ON public.drive_notification_prefs;
CREATE TRIGGER trg_touch_dnp BEFORE UPDATE ON public.drive_notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.touch_drive_notification_prefs();

-- Update activation trigger to respect in-app preference
CREATE OR REPLACE FUNCTION public.notify_drive_circle_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  became_active boolean := false;
BEGIN
  IF (NEW.status = 'active' AND COALESCE(OLD.status,'') <> 'active') THEN
    became_active := true;
  ELSIF (NEW.target_pool IS NOT NULL AND NEW.target_pool > 0
         AND NEW.current_pool >= NEW.target_pool
         AND COALESCE(OLD.current_pool,0) < NEW.target_pool) THEN
    became_active := true;
  ELSIF (NEW.members_count IS NOT NULL AND NEW.members_count >= 12
         AND COALESCE(OLD.members_count,0) < 12) THEN
    became_active := true;
  END IF;

  IF became_active THEN
    INSERT INTO public.notifications (member_id, title, body, kind, link)
    SELECT dm.member_id,
           'Your Drive circle is live 🚗',
           COALESCE(NEW.name,'Your circle') || ' just hit full seats and activated. First weekly contribution starts now.',
           'drive_activated',
           '/drive'
      FROM public.drive_members dm
      LEFT JOIN public.drive_notification_prefs p
        ON p.member_id = dm.member_id AND p.circle_id = dm.circle_id
     WHERE dm.circle_id = NEW.id
       AND dm.member_id IS NOT NULL
       AND COALESCE(p.in_app, true) = true;
  END IF;

  RETURN NEW;
END;
$$;
