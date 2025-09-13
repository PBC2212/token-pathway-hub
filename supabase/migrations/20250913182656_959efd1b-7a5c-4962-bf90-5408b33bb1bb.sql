-- Add status and admin approval tracking to pledges table
ALTER TABLE public.pledges 
ADD COLUMN status text DEFAULT 'pending' NOT NULL,
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN admin_notes text;

-- Add constraint to ensure status is one of the valid values
ALTER TABLE public.pledges 
ADD CONSTRAINT pledges_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Create index for faster queries on status
CREATE INDEX idx_pledges_status ON public.pledges(status);

-- Update RLS policies to allow admins to approve pledges
DROP POLICY IF EXISTS "Admins can manage all pledges" ON public.pledges;

CREATE POLICY "Admins can manage all pledges" 
ON public.pledges 
FOR ALL
USING (EXISTS ( 
  SELECT 1
  FROM profiles
  WHERE (profiles.user_id = auth.uid()) AND (profiles.role = 'admin'::text)
));

-- Create a function to approve/reject pledges (admin only)
CREATE OR REPLACE FUNCTION public.update_pledge_status(
  p_pledge_id uuid,
  p_status text,
  p_admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can update pledge status
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update pledge status';
  END IF;
  
  -- Validate status
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Must be: pending, approved, or rejected';
  END IF;
  
  -- Update the pledge
  UPDATE public.pledges 
  SET 
    status = p_status,
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_pledge_id;
  
  RETURN true;
END;
$$;