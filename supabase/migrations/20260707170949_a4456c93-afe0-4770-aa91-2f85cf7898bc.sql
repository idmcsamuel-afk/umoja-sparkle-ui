
-- Remove the broken jobs (they called a non-existent http_post function)
SELECT cron.unschedule(13);
SELECT cron.unschedule(15);

-- Reschedule with net.http_post (pg_net) — this is what actually exists in this DB
SELECT cron.schedule(
  'scrape-takealot-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/scrape-takealot-daily',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'scrape-takealot-collect',
  '15 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/scrape-takealot-collect',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbW9oY29pamtwaWd5Z2lxeWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDQ1MDksImV4cCI6MjA5MjM4MDUwOX0.Wn98x8GRE9EZnAUfe3Mm5VNLqv5UKd99rCNwEn8FuFc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
