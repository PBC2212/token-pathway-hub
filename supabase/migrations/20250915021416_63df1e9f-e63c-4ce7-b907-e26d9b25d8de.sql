-- Complete Security Implementation - Part 2

-- Step 1: Create new restricted admin read policy
DROP POLICY IF EXISTS "admin_basic_read_only" ON public.pledges;

CREATE POLICY "admin_restricted_read"
ON public.pledges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
  -- Admin access is logged, but they get limited data through direct table access
  -- Sensitive data must be accessed through secure functions
  AND public.log_admin_access('ADMIN_TABLE_ACCESS', 'pledges', pledges.id) = TRUE
);

-- Step 2: Update admin update policy to be more restrictive
DROP POLICY IF EXISTS "admin_status_update_only" ON public.pledges;
DROP POLICY IF EXISTS "admin_update_limited" ON public.pledges;
DROP POLICY IF EXISTS "admin_status_update_secure" ON public.pledges;

CREATE POLICY "admin_status_only_update"
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
  -- Prevent modification of sensitive financial data
  OLD.user_id = NEW.user_id AND
  OLD.appraised_value = NEW.appraised_value AND
  OLD.user_address = NEW.user_address AND
  OLD.asset_type = NEW.asset_type AND
  OLD.description = NEW.description AND
  OLD.document_hash = NEW.document_hash AND
  OLD.appraiser_license = NEW.appraiser_license AND
  OLD.token_amount = NEW.token_amount AND
  -- Allow updates only to admin-managed fields
  public.log_admin_access('UPDATE_ADMIN_FIELDS', 'pledges', NEW.id, 
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_admin_notes', OLD.admin_notes,
      'new_admin_notes', NEW.admin_notes
    )
  ) = TRUE
);

-- Step 3: Grant permissions to new secure functions
GRANT EXECUTE ON FUNCTION public.get_pledges_admin_secure(TEXT, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pledge_sensitive_emergency(UUID, TEXT, TEXT) TO authenticated;

-- Step 4: Create monitoring function for suspicious admin activity
CREATE OR REPLACE FUNCTION public.monitor_admin_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_access_count INTEGER;
  recent_emergency_access_count INTEGER;
BEGIN
  -- Check for excessive sensitive data access
  IF NEW.action LIKE '%SENSITIVE%' OR NEW.action LIKE '%EMERGENCY%' THEN
    -- Count sensitive access in last 24 hours
    SELECT COUNT(*) INTO sensitive_access_count
    FROM public.audit_logs
    WHERE user_id = NEW.user_id
      AND (action LIKE '%SENSITIVE%' OR action LIKE '%EMERGENCY%')
      AND created_at > NOW() - INTERVAL '24 hours';
    
    -- Alert if too many sensitive accesses
    IF sensitive_access_count > 5 THEN
      INSERT INTO public.audit_logs (user_id, action, table_name, accessed_data)
      VALUES (
        NEW.user_id,
        'EXCESSIVE_SENSITIVE_DATA_ACCESS_ALERT',
        'security_monitoring',
        jsonb_build_object(
          'sensitive_access_count_24h', sensitive_access_count,
          'threshold_exceeded', true,
          'requires_review', true
        )
      );
    END IF;
    
    -- Count emergency accesses in last week
    SELECT COUNT(*) INTO recent_emergency_access_count
    FROM public.audit_logs
    WHERE user_id = NEW.user_id
      AND action LIKE '%EMERGENCY%'
      AND created_at > NOW() - INTERVAL '7 days';
    
    -- Flag unusual emergency access patterns
    IF recent_emergency_access_count > 2 THEN
      INSERT INTO public.audit_logs (user_id, action, table_name, accessed_data)
      VALUES (
        NEW.user_id,
        'UNUSUAL_EMERGENCY_ACCESS_PATTERN',
        'security_monitoring',
        jsonb_build_object(
          'emergency_access_count_7d', recent_emergency_access_count,
          'requires_security_review', true
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger for enhanced monitoring
DROP TRIGGER IF EXISTS enhanced_admin_monitoring ON public.audit_logs;
CREATE TRIGGER enhanced_admin_monitoring
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.monitor_admin_data_access();

-- Step 6: Create function to get security summary for admins
CREATE OR REPLACE FUNCTION public.get_security_summary()
RETURNS TABLE (
  metric_name TEXT,
  metric_value TEXT,
  alert_level TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  admin_access_count INTEGER;
  sensitive_access_count INTEGER;
  emergency_access_count INTEGER;
BEGIN
  -- Verify admin access
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Log access to security summary
  PERFORM public.log_admin_access('VIEW_SECURITY_SUMMARY', 'audit_logs');
  
  -- Get admin access counts
  SELECT COUNT(*) INTO admin_access_count
  FROM public.audit_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND action LIKE '%ADMIN%';
    
  SELECT COUNT(*) INTO sensitive_access_count
  FROM public.audit_logs
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND action LIKE '%SENSITIVE%';
    
  SELECT COUNT(*) INTO emergency_access_count
  FROM public.audit_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
    AND action LIKE '%EMERGENCY%';
  
  -- Return security metrics
  RETURN QUERY VALUES
    ('Admin Access (24h)', admin_access_count::TEXT, 
     CASE WHEN admin_access_count > 50 THEN 'HIGH' WHEN admin_access_count > 20 THEN 'MEDIUM' ELSE 'LOW' END,
     'Number of admin actions in the last 24 hours'),
    ('Sensitive Data Access (24h)', sensitive_access_count::TEXT,
     CASE WHEN sensitive_access_count > 10 THEN 'HIGH' WHEN sensitive_access_count > 5 THEN 'MEDIUM' ELSE 'LOW' END,
     'Number of sensitive data accesses in the last 24 hours'),
    ('Emergency Access (7d)', emergency_access_count::TEXT,
     CASE WHEN emergency_access_count > 5 THEN 'HIGH' WHEN emergency_access_count > 2 THEN 'MEDIUM' ELSE 'LOW' END,
     'Number of emergency data accesses in the last 7 days');
END;
$$;

-- Step 7: Grant permission for security summary
GRANT EXECUTE ON FUNCTION public.get_security_summary() TO authenticated;