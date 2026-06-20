CREATE TABLE public.takealot_scrape_jobs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  collection_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  triggered_at TIMESTAMP NOT NULL DEFAULT now(),
  polling_started_at TIMESTAMP,
  polling_completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  product_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.takealot_scrape_jobs TO authenticated;
GRANT ALL ON public.takealot_scrape_jobs TO service_role;

ALTER TABLE public.takealot_scrape_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scrape jobs" ON public.takealot_scrape_jobs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated users can view scrape jobs" ON public.takealot_scrape_jobs FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_takealot_scrape_jobs_status ON public.takealot_scrape_jobs(status);
CREATE INDEX idx_takealot_scrape_jobs_triggered_at ON public.takealot_scrape_jobs(triggered_at);

CREATE OR REPLACE FUNCTION public.update_takealot_scrape_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_takealot_scrape_jobs_updated_at
BEFORE UPDATE ON public.takealot_scrape_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_takealot_scrape_jobs_updated_at();