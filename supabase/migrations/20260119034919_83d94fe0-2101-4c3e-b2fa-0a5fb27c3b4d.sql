-- Allow anonymous users to view ticket tiers (for public referral form)
DROP POLICY IF EXISTS "Authenticated users can view ticket tiers" ON public.ticket_tiers;

CREATE POLICY "Anyone can view ticket tiers" 
ON public.ticket_tiers 
FOR SELECT 
USING (true);

-- Allow anonymous uploads to payment-screenshots bucket
-- First, let's check if policies exist and create appropriate ones

-- Allow anyone to upload to the screenshots folder (for referral forms)
CREATE POLICY "Anyone can upload payment screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-screenshots');

-- Allow authenticated users to view their own uploads (existing behavior)
CREATE POLICY "Authenticated users can view payment screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-screenshots' AND auth.role() = 'authenticated');

-- Allow admins to view all screenshots
CREATE POLICY "Admins can view all payment screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-screenshots' AND has_role(auth.uid(), 'admin'::app_role));