-- Fix Security Definer View Issue - Corrected Version

-- Step 1: Drop the problematic view that was created by postgres superuser
DROP VIEW IF EXISTS public.pledges_analytics_safe;

-- Step 2: Create a secure function instead that respects RLS and user permissions
CREATE OR REPLACE FUNCTION public.get_pledges_analytics_safe()
RETURNS TABLE (
  asset_type TEXT,
  status TEXT,
  total_count BIGINT,
  avg_value_rounded NUMERIC,
  week_created TIMESTAMP WITH TIME ZONE,
  month_num NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER -- This ensures it runs with the calling user's privileges, not the creator's
STABLE
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Check if user is admin (only admins should access analytics)
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required for analytics data';
  END IF;
  
  -- Log admin access to analytics
  PERFORM public.log_admin_access('VIEW_ANALYTICS', 'pledges');
  
  -- Return aggregated data (this respects RLS policies automatically)
  RETURN QUERY
  SELECT 
    p.asset_type,
    p.status,
    COUNT(*) as total_count,
    ROUND(AVG(p.appraised_value), -3) as avg_value_rounded, -- Rounded to nearest thousand
    DATE_TRUNC('week', p.created_at) as week_created,
    EXTRACT(MONTH FROM p.created_at) as month_num
  FROM public.pledges p
  GROUP BY p.asset_type, p.status, DATE_TRUNC('week', p.created_at), EXTRACT(MONTH FROM p.created_at)
  HAVING COUNT(*) >= 3 -- Only show aggregates with sufficient data for privacy
  ORDER BY week_created DESC;
END;
$$;

-- Step 3: Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.get_pledges_analytics_safe() TO authenticated;

-- Step 4: Verify the problematic view is gone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' 
    AND viewname = 'pledges_analytics_safe'
  ) THEN
    RAISE NOTICE 'Successfully removed the problematic Security Definer view';
  ELSE
    RAISE NOTICE 'Warning: View still exists';
  END IF;
END $$;