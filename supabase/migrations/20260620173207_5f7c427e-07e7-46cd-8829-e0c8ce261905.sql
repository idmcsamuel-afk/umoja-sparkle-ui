
CREATE TABLE IF NOT EXISTS public.fulfillment_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payment_reference TEXT,
  waybill_number TEXT,
  tracking_url TEXT,
  courier TEXT NOT NULL DEFAULT 'thecourierguy',
  status TEXT NOT NULL DEFAULT 'created',
  raw_response JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fulfillment_shipments_unique_source
  ON public.fulfillment_shipments (source_type, source_id);

GRANT SELECT ON public.fulfillment_shipments TO authenticated;
GRANT ALL ON public.fulfillment_shipments TO service_role;

ALTER TABLE public.fulfillment_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own shipments"
  ON public.fulfillment_shipments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);
