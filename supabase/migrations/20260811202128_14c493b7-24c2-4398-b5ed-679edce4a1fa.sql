ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS delivery_location text;

UPDATE public.tenders
SET delivery_location = NULLIF(btrim(raw_json->'tender'->>'deliveryLocation'), '')
WHERE delivery_location IS NULL;

CREATE INDEX IF NOT EXISTS tenders_delivery_location_lower_idx
  ON public.tenders (lower(delivery_location));

CREATE INDEX IF NOT EXISTS tenders_closing_at_idx ON public.tenders (closing_at);