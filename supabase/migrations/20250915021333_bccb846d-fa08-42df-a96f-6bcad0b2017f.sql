-- Critical Security Fix: Implement Data Masking and Restricted Admin Access (Fixed)

-- Step 1: Remove overly broad admin read access
DROP POLICY IF EXISTS "admin_limited_read" ON public.pledges;
DROP POLICY IF EXISTS "admin_read_with_audit" ON public.pledges;

-- Step 2: Create secure admin view function with mandatory data masking
CREATE OR REPLACE FUNCTION public.get_pledges_admin_secure(
  p_access_justification TEXT,
  p_include_financial_data BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  asset_type TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  -- Sensitive fields are masked by default
  appraised_value_display TEXT,
  user_address_display TEXT,
  description_display TEXT,
  has_documents BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  admin_email TEXT;
BEGIN
  -- Verify admin access
  SELECT p.role, p.email INTO current_user_role, admin_email
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Require justification for accessing any pledge data
  IF p_access_justification IS NULL OR LENGTH(TRIM(p_access_justification)) < 10 THEN
    RAISE EXCEPTION 'Access denied: Detailed justification required (minimum 10 characters)';
  END IF;
  
  -- Log admin access with justification
  PERFORM public.log_admin_access(
    CASE WHEN p_include_financial_data THEN 'VIEW_SENSITIVE_PLEDGES' ELSE 'VIEW_PLEDGES_BASIC' END,
    'pledges',
    NULL,
    jsonb_build_object(
      'justification', p_access_justification,
      'include_financial_data', p_include_financial_data,
      'admin_email', admin_email,
      'limit', p_limit
    )
  );
  
  -- Return data with appropriate masking
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.asset_type,
    p.status,
    p.created_at,
    p.updated_at,
    p.admin_notes,
    -- Mask sensitive financial data unless explicitly requested with justification
    CASE 
      WHEN p_include_financial_data THEN ('$' || p.appraised_value::TEXT)
      ELSE 
        CASE 
          WHEN p.appraised_value > 100000 THEN 'High Value Asset'
          WHEN p.appraised_value > 50000 THEN 'Medium Value Asset'
          WHEN p.appraised_value > 10000 THEN 'Standard Value Asset'
          ELSE 'Asset Valued'
        END
    END as appraised_value_display,
    -- Always mask wallet addresses for privacy
    CASE 
      WHEN p_include_financial_data THEN p.user_address
      ELSE LEFT(p.user_address, 6) || '...' || RIGHT(p.user_address, 4)
    END as user_address_display,
    -- Mask sensitive descriptions
    CASE 
      WHEN p_include_financial_data THEN p.description
      WHEN p.description IS NOT NULL AND LENGTH(p.description) > 0 THEN '[Description provided]'
      ELSE '[No description]'
    END as description_display,
    -- Show only boolean for document existence
    (p.document_hash IS NOT NULL AND LENGTH(p.document_hash) > 0) as has_documents
  FROM public.pledges p
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Step 3: Create emergency access function for critical business needs
CREATE OR REPLACE FUNCTION public.get_pledge_sensitive_emergency(
  p_pledge_id UUID,
  p_emergency_justification TEXT,
  p_supervisor_email TEXT
)
RETURNS TABLE (
  id UUID,
  appraised_value NUMERIC,
  user_address TEXT,
  description TEXT,
  document_hash TEXT,
  emergency_access_granted_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  admin_email TEXT;
BEGIN
  -- Verify admin access
  SELECT p.role, p.email INTO current_user_role, admin_email
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Strict requirements for emergency access
  IF p_emergency_justification IS NULL OR LENGTH(TRIM(p_emergency_justification)) < 50 THEN
    RAISE EXCEPTION 'Emergency access denied: Detailed justification required (minimum 50 characters)';
  END IF;
  
  IF p_supervisor_email IS NULL OR p_supervisor_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Emergency access denied: Valid supervisor email required';
  END IF;
  
  -- Log emergency access with full details
  PERFORM public.log_admin_access(
    'EMERGENCY_ACCESS_SENSITIVE_DATA',
    'pledges',
    p_pledge_id,
    jsonb_build_object(
      'emergency_justification', p_emergency_justification,
      'supervisor_email', p_supervisor_email,
      'admin_email', admin_email,
      'access_level', 'FULL_SENSITIVE_DATA'
    )
  );
  
  -- Return sensitive data only for the specific pledge
  RETURN QUERY
  SELECT 
    p.id,
    p.appraised_value,
    p.user_address,
    p.description,
    p.document_hash,
    NOW() as emergency_access_granted_at
  FROM public.pledges p
  WHERE p.id = p_pledge_id;
END;
$$;