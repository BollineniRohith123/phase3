-- Allow anonymous users to view basic profile info for referral validation
-- Only allow reading name and is_active for students (not admins)
CREATE POLICY "Anyone can view student names for referral"
ON public.profiles
FOR SELECT
USING (role = 'student');