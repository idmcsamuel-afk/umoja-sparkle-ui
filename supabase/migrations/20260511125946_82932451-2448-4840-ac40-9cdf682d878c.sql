ALTER TABLE public.circle_bids DROP CONSTRAINT IF EXISTS circle_bids_status_check;
ALTER TABLE public.circle_bids ADD CONSTRAINT circle_bids_status_check
  CHECK (status IN ('pending','payment_pending','active','matched','paid','cancelled','suspended','refunded','rejected','vault','payout_due','queued','pending_payment'));