
ALTER TABLE public.circle_bids                          ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.reit_units                           ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.drive_contributions                  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.spark_trade_inventory_reservations   ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.spark_trade_group_brand_investors    ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE public.product_memberships                  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_circle_bids_quarantined ON public.circle_bids (quarantined_at) WHERE quarantined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reit_units_quarantined ON public.reit_units (quarantined_at) WHERE quarantined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_drive_contributions_quarantined ON public.drive_contributions (quarantined_at) WHERE quarantined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stir_quarantined ON public.spark_trade_inventory_reservations (quarantined_at) WHERE quarantined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stgbi_quarantined ON public.spark_trade_group_brand_investors (quarantined_at) WHERE quarantined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_quarantined ON public.product_memberships (quarantined_at) WHERE quarantined_at IS NULL;
