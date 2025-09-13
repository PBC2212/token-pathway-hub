-- Fix infinite recursion in admin policy by using the existing security definer function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'admin');