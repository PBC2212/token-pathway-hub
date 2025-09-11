-- Fix infinite recursion in profiles RLS by using a SECURITY DEFINER helper
-- 1) Create helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 2) Replace problematic policy that referenced the same table directly
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3) Recreate an admin policy without recursion
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.get_current_user_role() = 'admin');