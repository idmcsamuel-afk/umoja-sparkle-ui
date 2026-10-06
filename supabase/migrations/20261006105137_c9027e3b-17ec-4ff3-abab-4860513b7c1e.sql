ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS admin_notification_emails text[] NOT NULL DEFAULT ARRAY['support@umojarise.com']::text[];

CREATE TABLE IF NOT EXISTS public.circle_bid_admin_alerts (
  bid_id uuid PRIMARY KEY,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  recipients text[],
  error text
);
GRANT SELECT ON public.circle_bid_admin_alerts TO authenticated;
GRANT ALL ON public.circle_bid_admin_alerts TO service_role;
ALTER TABLE public.circle_bid_admin_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read bid alerts" ON public.circle_bid_admin_alerts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.notify_admin_bid_needs_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted uuid;
BEGIN
  IF NEW.status = 'payment_pending'
     AND COALESCE(length(NEW.payment_proof_url),0) > 0
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status
          OR COALESCE(OLD.payment_proof_url,'') = '') THEN
    INSERT INTO public.circle_bid_admin_alerts(bid_id) VALUES (NEW.id)
      ON CONFLICT (bid_id) DO NOTHING RETURNING bid_id INTO v_inserted;
    IF v_inserted IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/notify-admin-bid',
          headers := jsonb_build_object('Content-Type','application/json',
            'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc'),
          body := jsonb_build_object('bid_id', NEW.id));
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.circle_bid_admin_alerts SET error = SQLERRM WHERE bid_id = NEW.id;
      END;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS zz_trg_notify_admin_bid_needs_approval ON public.circle_bids;
CREATE TRIGGER zz_trg_notify_admin_bid_needs_approval
AFTER INSERT OR UPDATE OF status, payment_proof_url ON public.circle_bids
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_bid_needs_approval();

-- Mark bids already in the queue so they don't all email at once
INSERT INTO public.circle_bid_admin_alerts(bid_id, sent_at, error)
SELECT id, now(), 'pre-existing; not emailed' FROM public.circle_bids
WHERE status = 'payment_pending' ON CONFLICT DO NOTHING;