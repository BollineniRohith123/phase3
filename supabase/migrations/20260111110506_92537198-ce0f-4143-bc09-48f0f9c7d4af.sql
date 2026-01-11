-- Create function to decrement ticket quantity
CREATE OR REPLACE FUNCTION public.decrement_ticket_qty(p_tier_id UUID, p_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ticket_tiers
  SET remaining_qty = remaining_qty - p_qty
  WHERE id = p_tier_id;
END;
$$;