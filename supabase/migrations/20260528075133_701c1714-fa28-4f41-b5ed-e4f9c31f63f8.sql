
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_password_changed timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_by uuid;
