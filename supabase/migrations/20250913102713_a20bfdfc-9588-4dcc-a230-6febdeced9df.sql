-- First, let's see what policies exist and drop ALL of them
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all existing policies on profiles table
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- Create secure policies with explicit authentication checks

-- SELECT: Users can view their own profile, admins can view all profiles
-- CRITICAL: Explicit auth.uid() IS NOT NULL check prevents unauthenticated access
CREATE POLICY "authenticated_users_own_profile_select" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id 
    OR public.get_current_user_role() = 'admin'
  )
);

-- INSERT: Users can only insert their own profile
-- CRITICAL: Explicit authentication check and user_id must match auth.uid()
CREATE POLICY "authenticated_users_own_profile_insert" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- UPDATE: Users can update their own profile, admins can update any profile
-- CRITICAL: Explicit authentication check prevents unauthorized updates
CREATE POLICY "authenticated_users_own_profile_update" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id 
    OR public.get_current_user_role() = 'admin'
  )
);

-- DELETE: Only admins can delete profiles
-- CRITICAL: Only authenticated admins can delete profiles
CREATE POLICY "authenticated_admins_only_delete" 
ON public.profiles 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND public.get_current_user_role() = 'admin'
);

-- Add additional security function to validate profile access
CREATE OR REPLACE FUNCTION public.can_access_profile(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Users can access their own profile
  IF auth.uid() = target_user_id THEN
    RETURN true;
  END IF;
  
  -- Admins can access any profile
  IF public.get_current_user_role() = 'admin' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;