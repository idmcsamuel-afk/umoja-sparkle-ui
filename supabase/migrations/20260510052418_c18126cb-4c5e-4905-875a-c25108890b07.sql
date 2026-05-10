-- Allow everyone to read circle tiers (public catalog)
CREATE POLICY "circle_tiers_select" ON public.circle_tiers
  FOR SELECT TO anon, authenticated USING (true);

-- Refresh predictor questions so they aren't expired
UPDATE public.predictor_questions
   SET closes_at = now() + interval '7 days'
 WHERE status = 'active'
   AND (closes_at IS NULL OR closes_at <= now());