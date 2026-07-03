ALTER TABLE public.spark_trade_opportunities ADD COLUMN IF NOT EXISTS member_min_buyin_zar numeric NULL;

INSERT INTO public.spark_trade_settings (key, value) VALUES ('min_item_buyin_zar', 400)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.spark_trade_settings (key, value) VALUES ('min_order_total_zar', 2500)
ON CONFLICT (key) DO NOTHING;