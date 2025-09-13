-- Drop ALL existing policies on token_balances table
DROP POLICY IF EXISTS "Authenticated users can view their own balances" ON public.token_balances;
DROP POLICY IF EXISTS "Users can view own balances, admins view all" ON public.token_balances;
DROP POLICY IF EXISTS "System can update token balances" ON public.token_balances;

-- Create a security definer function to check if the current user is a service role or admin
CREATE OR REPLACE FUNCTION public.is_service_role_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current role is service_role (for edge functions)
  IF current_setting('role') = 'service_role' THEN
    RETURN true;
  END IF;
  
  -- Check if authenticated user is an admin
  IF auth.uid() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    );
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Create secure policies for token_balances

-- Allow users to view their own token balances and admins to view all
CREATE POLICY "secure_select_token_balances" 
ON public.token_balances 
FOR SELECT 
USING (
  auth.uid()::text = user_address 
  OR public.get_current_user_role() = 'admin'
);

-- Only service role (edge functions) and admins can insert new token balance records
CREATE POLICY "secure_insert_token_balances" 
ON public.token_balances 
FOR INSERT 
WITH CHECK (public.is_service_role_or_admin());

-- Only service role (edge functions) and admins can update token balances
CREATE POLICY "secure_update_token_balances" 
ON public.token_balances 
FOR UPDATE 
USING (public.is_service_role_or_admin());

-- Only admins can delete token balance records (service role should not delete)
CREATE POLICY "secure_delete_token_balances" 
ON public.token_balances 
FOR DELETE 
USING (public.get_current_user_role() = 'admin');

-- Add a function to safely update token balances (for additional security)
CREATE OR REPLACE FUNCTION public.update_user_token_balance(
  p_user_address TEXT,
  p_token_symbol TEXT,
  p_new_balance NUMERIC
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Additional validation
  IF p_user_address IS NULL OR p_token_symbol IS NULL OR p_new_balance < 0 THEN
    RAISE EXCEPTION 'Invalid parameters for token balance update';
  END IF;
  
  -- Only allow service role or admin to call this function
  IF NOT public.is_service_role_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only service role or admin can update token balances';
  END IF;
  
  -- Upsert the balance
  INSERT INTO public.token_balances (user_address, token_symbol, balance, updated_at)
  VALUES (p_user_address, p_token_symbol, p_new_balance, now())
  ON CONFLICT (user_address, token_symbol)
  DO UPDATE SET 
    balance = EXCLUDED.balance,
    updated_at = EXCLUDED.updated_at;
    
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;