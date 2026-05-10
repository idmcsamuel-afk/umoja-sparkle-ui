INSERT INTO public.predictor_questions (question, category, options, status, sparks_cost, sparks_reward, closes_at) VALUES
('Will the Rand strengthen below R17.50/USD this week?', 'Economy', '["Yes","No"]'::jsonb, 'active', 10, 25, now() + interval '7 days'),
('Which sector will lead the JSE next week?', 'Markets', '["Mining","Financials","Retail","Tech"]'::jsonb, 'active', 10, 30, now() + interval '7 days'),
('Will SARB cut the repo rate at the next MPC meeting?', 'Economy', '["Cut","Hold","Hike"]'::jsonb, 'active', 15, 40, now() + interval '14 days'),
('Top trending Spark Trade product this week?', 'Trade', '["Beauty","Electronics","Home","Apparel"]'::jsonb, 'active', 10, 25, now() + interval '7 days'),
('Bitcoin closing price on Sunday — above or below $100k?', 'Crypto', '["Above","Below"]'::jsonb, 'active', 10, 25, now() + interval '7 days');