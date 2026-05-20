SELECT cron.unschedule('zcreator-auto-generate-6h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='zcreator-auto-generate-6h');

SELECT cron.schedule(
  'zcreator-auto-generate-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/zcreator-auto-generate',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);