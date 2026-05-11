ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS seed_override_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS growth_override_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS harvest_override_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_expires_at timestamptz;