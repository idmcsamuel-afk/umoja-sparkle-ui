-- USDT payment support
ALTER TABLE public.circle_bids
  ADD COLUMN IF NOT EXISTS payment_crypto_network text,
  ADD COLUMN IF NOT EXISTS payment_crypto_txhash text,
  ADD COLUMN IF NOT EXISTS payment_crypto_address text,
  ADD COLUMN IF NOT EXISTS amount_usdt numeric(12,2),
  ADD COLUMN IF NOT EXISTS payout_crypto_txhash text,
  ADD COLUMN IF NOT EXISTS payout_crypto_network text;

CREATE UNIQUE INDEX IF NOT EXISTS circle_bids_crypto_txhash_unique
  ON public.circle_bids (payment_crypto_txhash)
  WHERE payment_crypto_txhash IS NOT NULL;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS usdt_trc20_address text,
  ADD COLUMN IF NOT EXISTS usdt_zar_rate numeric(12,4),
  ADD COLUMN IF NOT EXISTS crypto_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS usdt_wallet_trc20 text;

-- Schedule auto-verify cron (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('usdt-auto-verify-5m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'usdt-auto-verify-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/usdt-auto-verify',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := jsonb_build_object('ts', now())
  );
  $$
);