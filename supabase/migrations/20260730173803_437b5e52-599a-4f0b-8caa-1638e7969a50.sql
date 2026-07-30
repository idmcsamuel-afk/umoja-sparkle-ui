-- Amazon SA: every 2 days at 02:00
select cron.alter_job(
  (select jobid from cron.job where jobname = 'scan-amazon-products-sa-daily'),
  schedule := '0 2 */2 * *'
);

-- Amazon US: weekly, Monday 01:00
select cron.alter_job(
  (select jobid from cron.job where jobname = 'scan-amazon-products-daily'),
  schedule := '0 1 * * 1'
);

-- Walmart US: weekly, Monday 03:00
select cron.alter_job(
  (select jobid from cron.job where jobname = 'scan-walmart-products-daily'),
  schedule := '0 3 * * 1'
);