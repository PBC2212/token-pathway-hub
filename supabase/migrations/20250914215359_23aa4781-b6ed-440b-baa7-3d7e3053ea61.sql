-- Enable Row Level Security on blockchain_transactions table
ALTER TABLE public.blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Add user_id column for better security and consistency with other tables
ALTER TABLE public.blockchain_transactions 
ADD COLUMN user_id uuid;

-- Create RLS policies for blockchain_transactions

-- Users can view their own transactions (by user_id or user_address)
CREATE POLICY "Users can view their own blockchain transactions" 
ON public.blockchain_transactions 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  ((auth.uid())::text = user_address) OR
  (EXISTS ( 
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  ))
);

-- Users can insert their own transactions
CREATE POLICY "Users can create their own blockchain transactions" 
ON public.blockchain_transactions 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) OR 
  ((auth.uid())::text = user_address)
);

-- Service role and admins can insert transactions (for edge functions)
CREATE POLICY "Service role can insert blockchain transactions" 
ON public.blockchain_transactions 
FOR INSERT 
WITH CHECK (
  public.is_service_role_or_admin()
);

-- Service role and admins can update transactions
CREATE POLICY "Service role can update blockchain transactions" 
ON public.blockchain_transactions 
FOR UPDATE 
USING (
  public.is_service_role_or_admin()
);

-- Admins can manage all transactions
CREATE POLICY "Admins can manage all blockchain transactions" 
ON public.blockchain_transactions 
FOR ALL 
USING (
  EXISTS ( 
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Only admins can delete transactions (if needed)
CREATE POLICY "Admins can delete blockchain transactions" 
ON public.blockchain_transactions 
FOR DELETE 
USING (
  EXISTS ( 
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);