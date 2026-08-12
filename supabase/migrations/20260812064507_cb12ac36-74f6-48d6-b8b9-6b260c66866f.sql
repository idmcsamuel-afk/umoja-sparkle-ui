REVOKE ALL ON public.tender_intents FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.tender_intents FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tender_intents TO authenticated;