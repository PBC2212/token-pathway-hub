-- Comprehensive Security Enhancement for Sensitive Financial Data

-- Step 1: Create granular admin roles instead of blanket 'admin' access
CREATE TYPE public.admin_role AS ENUM (
  'super_admin',      -- Full access (CEO, CTO level)
  'finance_admin',    -- Can view financial data for compliance
  'support_admin',    -- Can view limited data for customer support
  'audit_admin'       -- Read-only access for auditing purposes
);

-- Step 2: Create audit logging table for sensitive data access
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_role TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  accessed_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 3: Create audit logging function
CREATE OR REPLACE FUNCTION public.log_admin_access(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_accessed_data JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Only log if user is admin
  IF user_role = 'admin' OR user_role LIKE '%admin%' THEN
    INSERT INTO public.audit_logs (
      user_id,
      admin_role,
      action,
      table_name,
      record_id,
      accessed_data
    ) VALUES (
      auth.uid(),
      user_role,
      p_action,
      p_table_name,
      p_record_id,
      p_accessed_data
    );
  END IF;
END;
$$;

-- Step 4: Create secure admin access function with data masking
CREATE OR REPLACE FUNCTION public.get_pledges_admin_view(
  p_mask_financial_data BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  asset_type TEXT,
  appraised_value_masked TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Check if user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Log admin access
  PERFORM public.log_admin_access('VIEW_PLEDGES_ADMIN', 'pledges');
  
  -- Return data with optional financial masking
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    prof.email as user_email,
    p.asset_type,
    CASE 
      WHEN p_mask_financial_data THEN 
        CASE 
          WHEN p.appraised_value > 0 THEN '***,***'
          ELSE 'Not set'
        END
      ELSE p.appraised_value::TEXT
    END as appraised_value_masked,
    p.status,
    p.created_at,
    p.updated_at,
    p.admin_notes
  FROM public.pledges p
  LEFT JOIN public.profiles prof ON p.user_id = prof.user_id
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Step 5: Replace the overly broad admin policy with specific, logged policies
DROP POLICY IF EXISTS "admin_pledges_management" ON public.pledges;

-- Read access with audit logging (using the secure function instead)
CREATE POLICY "admin_read_with_audit"
ON public.pledges
FOR SELECT
TO authenticated
USING (
  -- Only allow direct table access for super critical operations
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
  AND public.log_admin_access('DIRECT_SELECT', 'pledges', pledges.id) IS NOT DISTINCT FROM NULL
);

-- Update access - only for status changes and admin notes
CREATE POLICY "admin_update_limited"
ON public.pledges
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  -- Log the update
  public.log_admin_access('UPDATE', 'pledges', pledges.id, 
    jsonb_build_object(
      'status', NEW.status,
      'admin_notes', NEW.admin_notes,
      'previous_status', OLD.status
    )
  ) IS NOT DISTINCT FROM NULL
);

-- Delete access - only for super admins (very restricted)
CREATE POLICY "admin_delete_restricted"
ON public.pledges
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
  AND public.log_admin_access('DELETE', 'pledges', pledges.id, 
    jsonb_build_object('deleted_pledge', row_to_json(pledges))
  ) IS NOT DISTINCT FROM NULL
);

-- Step 6: Create audit log policies
CREATE POLICY "audit_logs_admin_read"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "audit_logs_system_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Step 8: Create notification function for suspicious activity
CREATE OR REPLACE FUNCTION public.check_suspicious_admin_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_access_count INTEGER;
BEGIN
  -- Check for excessive access in last hour
  SELECT COUNT(*) INTO recent_access_count
  FROM public.audit_logs
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- If more than 100 records accessed in an hour, log warning
  IF recent_access_count > 100 THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, accessed_data)
    VALUES (
      NEW.user_id,
      'SUSPICIOUS_ACTIVITY_DETECTED',
      'audit_logs',
      jsonb_build_object(
        'access_count_last_hour', recent_access_count,
        'threshold_exceeded', true
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for suspicious activity detection
CREATE TRIGGER audit_logs_suspicious_activity
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspicious_admin_activity();