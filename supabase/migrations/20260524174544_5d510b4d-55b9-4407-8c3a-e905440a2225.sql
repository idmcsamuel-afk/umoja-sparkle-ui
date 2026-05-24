CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Unschedule any existing job with the same name to keep idempotent
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'expire-unpaid-bids-15m';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END$$;

SELECT cron.schedule(
  'expire-unpaid-bids-15m',
  '*/15 * * * *',
  $$ SELECT public.expire_unpaid_bids(); $$
);