DROP POLICY IF EXISTS bids_update_member_safe ON public.circle_bids;

CREATE POLICY bids_update_member_safe ON public.circle_bids
  FOR UPDATE
  USING (
    auth.uid() = member_id
    AND COALESCE(status, 'pending') IN ('pending', 'payment_pending')
  )
  WITH CHECK (
    auth.uid() = member_id
    AND COALESCE(status, 'pending') IN ('pending', 'payment_pending')
  );