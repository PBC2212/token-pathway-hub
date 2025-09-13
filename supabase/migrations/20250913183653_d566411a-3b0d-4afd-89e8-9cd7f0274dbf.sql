-- Create admin user function and setup
CREATE OR REPLACE FUNCTION public.setup_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update any existing profile with admin@tokenization.com to admin role
  UPDATE public.profiles 
  SET role = 'admin', kyc_status = 'approved'
  WHERE email = 'admin@tokenization.com';
  
  -- If no profile exists, we'll handle it via trigger when user signs up
END;
$$;

-- Create trigger function to auto-assign admin role
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-assign admin role to admin@tokenization.com
  IF NEW.email = 'admin@tokenization.com' THEN
    NEW.role = 'admin';
    NEW.kyc_status = 'approved';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles insert and update
CREATE OR REPLACE TRIGGER auto_assign_admin_role_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_role();

-- Run the setup function
SELECT public.setup_admin_user();