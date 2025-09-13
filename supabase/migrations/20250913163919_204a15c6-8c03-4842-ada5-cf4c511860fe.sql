-- Fix security issues identified by the scanner

-- 1. Add missing RLS policy for users to view their own cognito submissions
-- Currently only admins can access, but users should see their own submissions
CREATE POLICY "Users can view their own cognito submissions"
ON public.cognito_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_agreements ua
    WHERE ua.id = cognito_submissions.user_agreement_id
    AND ua.user_id = auth.uid()
  )
);

-- 2. Make profiles table policy more explicit and restrictive
-- Replace the existing SELECT policy with a more restrictive one
DROP POLICY IF EXISTS "authenticated_users_own_profile_select" ON public.profiles;

CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Create separate admin policy for profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin'
  )
);

-- 4. Ensure token_balances has proper user-specific access
-- The current policy uses user_address as text, make sure it's properly restricted
DROP POLICY IF EXISTS "secure_select_token_balances" ON public.token_balances;

CREATE POLICY "Users can view their own token balances"
ON public.token_balances
FOR SELECT
TO authenticated
USING (
  (auth.uid())::text = user_address OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin'
  )
);