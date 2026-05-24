CREATE POLICY "Authenticated members can view active vault queue bids"
ON public.circle_bids
FOR SELECT
TO authenticated
USING (
  status = 'vault'
  AND vault_start IS NOT NULL
);