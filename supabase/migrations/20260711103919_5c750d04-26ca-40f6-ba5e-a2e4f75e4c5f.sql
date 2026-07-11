CREATE TABLE public.alibaba_tokens (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  raw JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.alibaba_tokens TO service_role;
ALTER TABLE public.alibaba_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS; no client access permitted.