-- Fix 1: Make payment-screenshots bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-screenshots';

-- Fix 2: Update storage policy to restrict access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view screenshots" ON storage.objects;

CREATE POLICY "Authenticated users can view screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-screenshots' AND auth.uid() IS NOT NULL);

-- Fix 3: Update decrement_ticket_qty function to be atomic with inventory check
CREATE OR REPLACE FUNCTION public.decrement_ticket_qty(p_tier_id UUID, p_qty INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  -- Check admin role
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can decrement ticket quantities';
  END IF;
  
  -- Atomic update with check for sufficient inventory
  UPDATE public.ticket_tiers
  SET remaining_qty = remaining_qty - p_qty,
      updated_at = now()
  WHERE id = p_tier_id AND remaining_qty >= p_qty;
  
  -- Check if the update was successful
  IF NOT FOUND THEN
    SELECT remaining_qty INTO v_remaining FROM public.ticket_tiers WHERE id = p_tier_id;
    IF v_remaining IS NULL THEN
      RAISE EXCEPTION 'Ticket tier not found';
    ELSE
      RAISE EXCEPTION 'Insufficient inventory: only % tickets remaining', v_remaining;
    END IF;
  END IF;
END;
$$;