
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
           '/drive?c=' || NEW.id::text
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
