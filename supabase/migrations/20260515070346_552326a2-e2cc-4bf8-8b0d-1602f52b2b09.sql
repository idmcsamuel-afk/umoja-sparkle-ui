CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior schedule with the same name
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'automation-cron-every-minute';

SELECT cron.schedule(
  'automation-cron-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/automation-cron',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);