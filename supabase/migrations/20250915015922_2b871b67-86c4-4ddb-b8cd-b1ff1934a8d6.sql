-- Fix Security Definer View Issue

-- Drop the problematic view
DROP VIEW IF EXISTS public.pledges_admin_summary;

-- Create a secure function instead that properly respects RLS and user permissions
CREATE OR REPLACE FUNCTION public.get_pledges_summary()
RETURNS TABLE (
  asset_type TEXT,
  status TEXT,
  pledge_count BIGINT,
  avg_appraised_value NUMERIC,
  total_appraised_value NUMERIC,
  month_created TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY INVOKER -- This ensures it runs with the calling user's privileges
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
  PERFORM public.log_admin_access('VIEW_PLEDGES_SUMMARY', 'pledges');
  
  -- Return aggregated data (this respects RLS policies)
  RETURN QUERY
  SELECT 
    p.asset_type,
    p.status,
    COUNT(*) as pledge_count,
    ROUND(AVG(p.appraised_value), 0) as avg_appraised_value,
    ROUND(SUM(p.appraised_value), 0) as total_appraised_value,
    DATE_TRUNC('month', p.created_at) as month_created
  FROM public.pledges p
  GROUP BY p.asset_type, p.status, DATE_TRUNC('month', p.created_at)
  ORDER BY month_created DESC, p.asset_type;
END;
$$;