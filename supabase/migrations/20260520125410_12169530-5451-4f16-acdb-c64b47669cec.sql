UPDATE public.zcreator_video_styles SET cost_rands = 7.04 WHERE style_code = 'stock';
UPDATE public.zcreator_video_styles SET cost_rands = 8.84 WHERE style_code = 'stock_premium';

UPDATE public.zcreator_subscriptions SET videos_per_month = 60 WHERE tier = 'creator';
UPDATE public.zcreator_subscriptions SET videos_per_month = 120 WHERE tier = 'pro';
UPDATE public.zcreator_subscriptions SET videos_per_month = 250 WHERE tier = 'agency';

ALTER TABLE public.zcreator_subscriptions ALTER COLUMN videos_per_month SET DEFAULT 2;