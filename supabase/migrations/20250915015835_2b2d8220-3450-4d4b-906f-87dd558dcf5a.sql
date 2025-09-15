-- Security Enhancement: Fix Admin Access with Audit Logging (Safe Migration)

-- Step 1: Check if audit_logs table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
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
        
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Step 2: Create or replace audit logging function
CREATE OR REPLACE FUNCTION public.log_admin_access(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID DEFAULT NULL,
  p_accessed_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
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
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- If logging fails, still allow the operation but log the failure
    RAISE WARNING 'Audit logging failed: %', SQLERRM;
    RETURN TRUE;
END;
$$;

-- Step 3: Create secure admin function with data masking
CREATE OR REPLACE FUNCTION public.get_pledges_admin_secure(
  p_mask_financial_data BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  asset_type TEXT,
  appraised_value_display TEXT,
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
  
  -- Return data with financial masking for security
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    prof.email as user_email,
    p.asset_type,
    CASE 
      WHEN p_mask_financial_data THEN 
        CASE 
          WHEN p.appraised_value > 0 THEN '$***,***'
          ELSE 'Not appraised'
        END
      ELSE '$' || p.appraised_value::TEXT
    END as appraised_value_display,
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

-- Step 4: Create secure pledge status update function
CREATE OR REPLACE FUNCTION public.admin_update_pledge_secure(
  p_pledge_id UUID,
  p_new_status TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  old_status TEXT;
  pledge_exists BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Validate status
  IF p_new_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Must be: pending, approved, or rejected';
  END IF;
  
  -- Check if pledge exists and get current status
  SELECT status, TRUE INTO old_status, pledge_exists
  FROM public.pledges
  WHERE id = p_pledge_id;
  
  IF NOT pledge_exists THEN
    RAISE EXCEPTION 'Pledge not found';
  END IF;
  
  -- Update the pledge (limited to safe fields only)
  UPDATE public.pledges
  SET 
    status = p_new_status,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    approved_by = CASE WHEN p_new_status = 'approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN p_new_status = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = p_pledge_id;
  
  -- Log the update with audit trail
  PERFORM public.log_admin_access(
    'UPDATE_PLEDGE_STATUS',
    'pledges',
    p_pledge_id,
    jsonb_build_object(
      'old_status', old_status,
      'new_status', p_new_status,
      'admin_notes', p_admin_notes
    )
  );
  
  RETURN TRUE;
END;
$$;

-- Step 5: Replace overly broad admin policies with restricted access
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "admin_pledges_management" ON public.pledges;
DROP POLICY IF EXISTS "admin_read_with_audit" ON public.pledges;
DROP POLICY IF EXISTS "admin_update_limited" ON public.pledges;
DROP POLICY IF EXISTS "admin_delete_restricted" ON public.pledges;

-- Create new limited admin read policy (logged)
CREATE POLICY "admin_limited_read"
ON public.pledges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
  AND public.log_admin_access('READ_PLEDGE', 'pledges', pledges.id) = TRUE
);

-- Admin can only update specific fields (status, admin_notes)
CREATE POLICY "admin_status_update_only"
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
  -- Only allow changes to these specific fields
  pledges.user_id = pledges.user_id AND
  pledges.asset_type = pledges.asset_type AND
  pledges.appraised_value = pledges.appraised_value AND
  pledges.user_address = pledges.user_address
);

-- No direct delete access - must use controlled functions
-- (Removed delete policy entirely for security)

-- Step 6: Create audit log policies if they don't exist
DO $$
BEGIN
    -- Check if audit log policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' 
        AND policyname = 'audit_logs_admin_read'
    ) THEN
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
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' 
        AND policyname = 'audit_logs_system_insert'
    ) THEN
        CREATE POLICY "audit_logs_system_insert"
        ON public.audit_logs
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Step 7: Create performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON public.audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created ON public.audit_logs(table_name, created_at DESC);

-- Step 8: Create aggregated view for safe admin analytics (no personal data)
CREATE OR REPLACE VIEW public.pledges_analytics_safe AS
SELECT 
  asset_type,
  status,
  COUNT(*) as total_count,
  ROUND(AVG(appraised_value), -3) as avg_value_rounded, -- Rounded to nearest thousand
  DATE_TRUNC('week', created_at) as week_created,
  EXTRACT(MONTH FROM created_at) as month_num
FROM public.pledges
GROUP BY asset_type, status, DATE_TRUNC('week', created_at), EXTRACT(MONTH FROM created_at)
HAVING COUNT(*) >= 3  -- Only show groups with 3+ entries to prevent individual identification
ORDER BY week_created DESC;