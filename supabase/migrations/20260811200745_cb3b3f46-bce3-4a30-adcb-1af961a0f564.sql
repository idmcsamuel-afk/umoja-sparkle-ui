CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('sync-tenders-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-tenders-daily');

SELECT cron.schedule(
  'sync-tenders-daily',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lamohcoijkpigygiqyih.supabase.co/functions/v1/sync-tenders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"days": 3, "page_size": 50, "max_pages": 40}'::jsonb
  ) AS request_id;
  $$
);