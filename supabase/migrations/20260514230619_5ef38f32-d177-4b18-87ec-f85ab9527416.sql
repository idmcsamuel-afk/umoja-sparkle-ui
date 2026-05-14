ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS tour_banner_dismissed_at timestamptz;