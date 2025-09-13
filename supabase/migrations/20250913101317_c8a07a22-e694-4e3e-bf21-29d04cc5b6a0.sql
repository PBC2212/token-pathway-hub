-- Create pledges table for asset tokenization
CREATE TABLE public.pledges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  appraised_value NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create token_balances table for tracking user balances
CREATE TABLE public.token_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_address, token_symbol)
);

-- Enable Row Level Security
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for pledges table
CREATE POLICY "Authenticated users can view their own pledges" 
ON public.pledges 
FOR SELECT 
USING (auth.uid()::text = user_address OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Authenticated users can create pledges" 
ON public.pledges 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_address);

CREATE POLICY "Admins can manage all pledges" 
ON public.pledges 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Create policies for token_balances table
CREATE POLICY "Authenticated users can view their own balances" 
ON public.token_balances 
FOR SELECT 
USING (auth.uid()::text = user_address OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "System can update token balances" 
ON public.token_balances 
FOR ALL 
USING (true);

-- Add indexes for better performance
CREATE INDEX idx_pledges_user_address ON public.pledges(user_address);
CREATE INDEX idx_pledges_created_at ON public.pledges(created_at);
CREATE INDEX idx_token_balances_user_address ON public.token_balances(user_address);

-- Create trigger for automatic timestamp updates on pledges
CREATE TRIGGER update_pledges_updated_at
BEFORE UPDATE ON public.pledges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on token_balances
CREATE TRIGGER update_token_balances_updated_at
BEFORE UPDATE ON public.token_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();