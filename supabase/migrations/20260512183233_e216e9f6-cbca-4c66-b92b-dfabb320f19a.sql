
CREATE OR REPLACE FUNCTION public._flip_contributed(_member uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.members
     SET has_contributed = true,
         first_contribution_at = COALESCE(first_contribution_at, now())
   WHERE id = _member AND has_contributed = false;
$$;

CREATE OR REPLACE FUNCTION public._trg_contrib_circle_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_confirmed_at IS NOT NULL AND (OLD.payment_confirmed_at IS NULL) THEN
    PERFORM public._flip_contributed(NEW.member_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contrib_circle_bid ON public.circle_bids;
CREATE TRIGGER trg_contrib_circle_bid AFTER UPDATE ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public._trg_contrib_circle_bid();

CREATE OR REPLACE FUNCTION public._trg_contrib_drive_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public._flip_contributed(NEW.member_id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_contrib_drive_member ON public.drive_members;
CREATE TRIGGER trg_contrib_drive_member AFTER INSERT ON public.drive_members
FOR EACH ROW EXECUTE FUNCTION public._trg_contrib_drive_member();

CREATE OR REPLACE FUNCTION public._trg_contrib_member_bc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.has_buyers_club_access = true AND COALESCE(OLD.has_buyers_club_access,false) = false THEN
    PERFORM public._flip_contributed(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contrib_member_bc ON public.members;
CREATE TRIGGER trg_contrib_member_bc AFTER UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public._trg_contrib_member_bc();

-- st_orders may or may not exist with member_id column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='st_orders' AND column_name='member_id') THEN
    EXECUTE $E$
      CREATE OR REPLACE FUNCTION public._trg_contrib_st_order()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $T$
      BEGIN PERFORM public._flip_contributed(NEW.member_id); RETURN NEW; END $T$;
    $E$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_contrib_st_order ON public.st_orders';
    EXECUTE 'CREATE TRIGGER trg_contrib_st_order AFTER INSERT ON public.st_orders FOR EACH ROW EXECUTE FUNCTION public._trg_contrib_st_order()';
  END IF;
END $$;

-- Backfill existing contributors
UPDATE public.members m SET has_contributed = true, first_contribution_at = COALESCE(first_contribution_at, now())
 WHERE has_contributed = false
   AND ( EXISTS (SELECT 1 FROM public.circle_bids b WHERE b.member_id = m.id AND b.payment_confirmed_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.drive_members d WHERE d.member_id = m.id)
      OR m.has_buyers_club_access = true );
