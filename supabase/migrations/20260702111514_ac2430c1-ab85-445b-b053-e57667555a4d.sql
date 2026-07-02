
CREATE OR REPLACE FUNCTION public.qualifying_contribution_zar(_member uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE((SELECT SUM(COALESCE(fiat_amount, net_amount, 0))
              FROM public.circle_bids
              WHERE member_id = _member
                AND status IN ('paid','vault','completed')
                AND COALESCE(is_valid_contribution, false) = true
                AND quarantined_at IS NULL), 0)
  + COALESCE((SELECT SUM(amount) FROM public.drive_contributions
              WHERE member_id = _member AND status = 'completed'), 0)
  + COALESCE((SELECT SUM(order_total) FROM public.st_orders
              WHERE member_id = _member AND status IN ('paid','completed')), 0)
  + COALESCE((SELECT SUM(total_amount) FROM public.fulfillment_invoices
              WHERE member_id = _member AND status = 'paid'), 0);
$function$;
