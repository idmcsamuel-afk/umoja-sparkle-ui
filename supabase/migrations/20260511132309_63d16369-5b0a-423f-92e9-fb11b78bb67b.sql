-- Audit log for circle_bids status transitions
CREATE TABLE IF NOT EXISTS public.circle_bid_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbse_bid_created
  ON public.circle_bid_status_events (bid_id, created_at DESC);

ALTER TABLE public.circle_bid_status_events ENABLE ROW LEVEL SECURITY;

-- Members can view their own bid history; admins can view all
CREATE POLICY "cbse_select_own_or_admin"
  ON public.circle_bid_status_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.circle_bids b
      WHERE b.id = circle_bid_status_events.bid_id
        AND b.member_id = auth.uid()
    )
  );

-- Inserts only happen via SECURITY DEFINER trigger; no direct insert policy.

CREATE OR REPLACE FUNCTION public.log_circle_bid_status_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.circle_bid_status_events (bid_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NULL, COALESCE(NEW.status, 'pending'), auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') IS DISTINCT FROM COALESCE(OLD.status,'') THEN
    INSERT INTO public.circle_bid_status_events (bid_id, from_status, to_status, actor_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_bids_status_audit_ins ON public.circle_bids;
CREATE TRIGGER trg_circle_bids_status_audit_ins
AFTER INSERT ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public.log_circle_bid_status_event();

DROP TRIGGER IF EXISTS trg_circle_bids_status_audit_upd ON public.circle_bids;
CREATE TRIGGER trg_circle_bids_status_audit_upd
AFTER UPDATE OF status ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public.log_circle_bid_status_event();

-- Backfill: seed an initial row for each existing bid using its current status
INSERT INTO public.circle_bid_status_events (bid_id, from_status, to_status, actor_id, created_at, note)
SELECT b.id, NULL, COALESCE(b.status,'pending'), NULL,
       COALESCE(b.created_at, now()), 'backfill'
  FROM public.circle_bids b
  LEFT JOIN public.circle_bid_status_events e ON e.bid_id = b.id
 WHERE e.id IS NULL;