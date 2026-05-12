
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS has_contributed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_contribution_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- mark contribution (callable by member for own row, or admin)
CREATE OR REPLACE FUNCTION public.mark_contributed(_member uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target uuid := COALESCE(_member, auth.uid());
BEGIN
  IF target IS NULL THEN RETURN; END IF;
  IF _member IS NOT NULL AND _member <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.members
     SET has_contributed = true,
         first_contribution_at = COALESCE(first_contribution_at, now())
   WHERE id = target AND has_contributed = false;
END $$;

-- presence ping
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.members SET last_seen_at = now() WHERE id = auth.uid();
$$;

-- active count (last 5 min)
CREATE OR REPLACE FUNCTION public.active_members_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.members WHERE last_seen_at > now() - interval '5 minutes';
$$;

-- admin: record a manual payout for a matched circle bid
CREATE OR REPLACE FUNCTION public.record_circle_payout(
  _bid_id uuid,
  _net_amount numeric,
  _method text,
  _reference text,
  _paid_on timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b public.circle_bids%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO b FROM public.circle_bids WHERE id = _bid_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'bid not found'; END IF;

  UPDATE public.circle_bids
     SET status = 'paid',
         payout_amount = _net_amount,
         payout_date = _paid_on,
         payment_ref = _reference
   WHERE id = _bid_id;

  INSERT INTO public.core_ledger (member_id, event_type, amount, note, reference_id)
    VALUES (b.member_id, 'circle_payout', _net_amount,
            COALESCE(_method,'manual') || ' · ' || COALESCE(_reference,''), _bid_id);

  INSERT INTO public.notifications (member_id, title, body, kind, link)
    VALUES (b.member_id, 'Payout sent 💰',
            'Your ' || b.tier || ' payout of R' || _net_amount || ' was paid via ' || COALESCE(_method,'EFT') || '.',
            'payout', '/circle');
END $$;
