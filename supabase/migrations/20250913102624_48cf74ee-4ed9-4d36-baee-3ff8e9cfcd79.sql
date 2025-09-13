-- Drop existing potentially vulnerable policies on profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create secure policies with explicit authentication checks

-- SELECT: Users can view their own profile, admins can view all profiles
-- CRITICAL: Explicit auth.uid() IS NOT NULL check prevents unauthenticated access
CREATE POLICY "secure_select_profiles" 
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
CREATE POLICY "secure_insert_profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- UPDATE: Users can update their own profile, admins can update any profile
-- CRITICAL: Explicit authentication check prevents unauthorized updates
CREATE POLICY "secure_update_profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id 
    OR public.get_current_user_role() = 'admin'
  )
);

-- DELETE: Only admins can delete profiles (users should not be able to delete their own profiles)
-- CRITICAL: Only authenticated admins can delete profiles
CREATE POLICY "secure_delete_profiles" 
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

-- Create a secure function for profile updates that includes additional validation
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_kyc_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Users can only update their own profile (except for kyc_status)
  IF auth.uid() != p_user_id AND public.get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another users profile';
  END IF;
  
  -- Only admins can change KYC status
  IF p_kyc_status IS NOT NULL AND public.get_current_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update KYC status';
  END IF;
  
  -- Validate KYC status values
  IF p_kyc_status IS NOT NULL AND p_kyc_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid KYC status. Must be: pending, approved, or rejected';
  END IF;
  
  -- Update the profile
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    kyc_status = COALESCE(p_kyc_status, kyc_status),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;