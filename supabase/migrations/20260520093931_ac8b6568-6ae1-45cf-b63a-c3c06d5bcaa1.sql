UPDATE public.zcreator_video_styles
SET cost_rands = 0.84,
    description = 'Stock footage + free AI voice (Edge TTS) + auto captions — YouTube-optimized, anti-ban',
    quality_tier = 'standard'
WHERE style_code = 'stock';

INSERT INTO public.zcreator_video_styles (style_code, display_name, description, cost_rands, quality_tier)
VALUES ('stock_premium', 'Stock + Premium Voice', 'Stock footage + ElevenLabs voice clone + auto captions', 6.84, 'premium')
ON CONFLICT (style_code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    cost_rands = EXCLUDED.cost_rands,
    quality_tier = EXCLUDED.quality_tier;