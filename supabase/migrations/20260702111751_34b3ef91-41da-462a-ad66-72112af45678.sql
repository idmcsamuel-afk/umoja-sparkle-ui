
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN bank_name DROP NOT NULL,
  ALTER COLUMN account_number DROP NOT NULL,
  ALTER COLUMN account_holder DROP NOT NULL;
