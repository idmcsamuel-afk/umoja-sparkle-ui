
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS buyers_club_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyers_club_renewal_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_approve_buyers_club(_member uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.members
    SET has_buyers_club_access = true,
        buyers_club_status = 'active',
        buyers_club_approved_at = now(),
        buyers_club_started_at = COALESCE(buyers_club_started_at, now()),
        buyers_club_renewal_at = GREATEST(COALESCE(buyers_club_renewal_at, now()), now()) + interval '1 month'
  WHERE id = _member;
  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Buyers Club approved 🎉',
            'Welcome — real product picks are unlocked for the next month.',
            'buyers_club', '/spark');
END $function$;

CREATE OR REPLACE FUNCTION public.admin_extend_buyers_club(_member uuid, _months int DEFAULT 1)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE new_renewal timestamptz;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _months IS NULL OR _months <= 0 THEN RAISE EXCEPTION 'months must be positive'; END IF;
  UPDATE public.members
    SET has_buyers_club_access = true,
        buyers_club_status = 'active',
        buyers_club_renewal_at = GREATEST(COALESCE(buyers_club_renewal_at, now()), now()) + (_months || ' months')::interval
  WHERE id = _member
  RETURNING buyers_club_renewal_at INTO new_renewal;

  INSERT INTO public.admin_audit_log (actor_id, action, target_member, details)
    VALUES (auth.uid(), 'extend_buyers_club', _member,
            jsonb_build_object('months', _months, 'new_renewal_at', new_renewal));

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (_member, 'Buyers Club extended ✨',
            'Your membership was extended by ' || _months || ' month(s).',
            'buyers_club', '/dashboard');
  RETURN new_renewal;
END $function$;
