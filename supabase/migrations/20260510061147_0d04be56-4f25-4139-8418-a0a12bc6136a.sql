
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
  ELSIF (NEW.target_pool IS NOT NULL
         AND NEW.target_pool > 0
         AND NEW.current_pool >= NEW.target_pool
         AND COALESCE(OLD.current_pool,0) < NEW.target_pool) THEN
    became_active := true;
  ELSIF (NEW.members_count IS NOT NULL
         AND NEW.members_count >= 12
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
     WHERE dm.circle_id = NEW.id
       AND dm.member_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_drive_circle_activated ON public.drive_circles;
CREATE TRIGGER trg_notify_drive_circle_activated
AFTER UPDATE ON public.drive_circles
FOR EACH ROW
EXECUTE FUNCTION public.notify_drive_circle_activated();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
