
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('zcreator-process-queue-2m');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'zcreator-process-queue-2m',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/zcreator-process-queue',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
