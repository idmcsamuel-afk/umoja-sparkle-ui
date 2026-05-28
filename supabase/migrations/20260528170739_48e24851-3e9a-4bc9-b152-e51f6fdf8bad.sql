ALTER TABLE public.members
  ALTER COLUMN marketplace_preference DROP DEFAULT,
  ALTER COLUMN marketplace_preference TYPE jsonb
  USING CASE
    WHEN marketplace_preference IS NULL OR marketplace_preference = '' THEN '[]'::jsonb
    WHEN left(marketplace_preference,1) = '[' THEN marketplace_preference::jsonb
    ELSE to_jsonb(ARRAY[marketplace_preference])
  END,
  ALTER COLUMN marketplace_preference SET DEFAULT '[]'::jsonb;

UPDATE public.members
SET marketplace_preference = '["Takealot","Makro","Amazon.sa"]'::jsonb
WHERE country = 'SA' AND (marketplace_preference = '[]'::jsonb OR marketplace_preference = '["Takealot"]'::jsonb);