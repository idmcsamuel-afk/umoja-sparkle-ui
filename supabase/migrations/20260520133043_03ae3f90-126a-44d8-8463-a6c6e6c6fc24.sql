
INSERT INTO public.zcreator_subscriptions (
  user_id, tier, videos_per_month, platforms_enabled, auto_publish_enabled,
  white_label_enabled, monthly_cost_sparks, monthly_cost_rands,
  videos_used_this_month, billing_cycle_starts_at, active
) VALUES (
  '12469fec-57da-41b8-8a40-2c9610bfbc21', 'creator', 60,
  ARRAY['youtube','tiktok','instagram'], true, false, 0, 0, 1, now(), true
)
ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  videos_per_month = EXCLUDED.videos_per_month,
  platforms_enabled = EXCLUDED.platforms_enabled,
  auto_publish_enabled = EXCLUDED.auto_publish_enabled,
  monthly_cost_sparks = 0,
  monthly_cost_rands = 0,
  videos_used_this_month = 1,
  billing_cycle_starts_at = now(),
  active = true;

UPDATE public.zcreator_content_queue
   SET status = 'failed',
       error_message = '[system] Generation timeout - exceeded 15 minutes. Click retry.',
       updated_at = now()
 WHERE user_id = '12469fec-57da-41b8-8a40-2c9610bfbc21'
   AND status = 'generating'
   AND created_at < now() - interval '15 minutes';
