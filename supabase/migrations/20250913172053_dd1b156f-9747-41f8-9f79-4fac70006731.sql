-- Create liquidity_pools table
CREATE TABLE public.liquidity_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_a TEXT NOT NULL,
  token_b TEXT NOT NULL,
  pool_type TEXT NOT NULL DEFAULT 'uniswap_v3',
  fee_rate TEXT NOT NULL DEFAULT '0.3',
  status TEXT NOT NULL DEFAULT 'pending',
  initial_liquidity_a NUMERIC NOT NULL,
  initial_liquidity_b NUMERIC NOT NULL,
  fireblocks_tx_id TEXT,
  pool_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create liquidity_operations table
CREATE TABLE public.liquidity_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pool_id UUID NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('add', 'remove')),
  token_a_amount NUMERIC NOT NULL,
  token_b_amount NUMERIC NOT NULL,
  fireblocks_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  slippage_tolerance TEXT DEFAULT '2.0',
  lp_tokens_received NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.liquidity_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_operations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for liquidity_pools
CREATE POLICY "Users can view their own pools"
ON public.liquidity_pools
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pools"
ON public.liquidity_pools
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pools"
ON public.liquidity_pools
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pools"
ON public.liquidity_pools
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Create RLS policies for liquidity_operations
CREATE POLICY "Users can view their own operations"
ON public.liquidity_operations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own operations"
ON public.liquidity_operations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own operations"
ON public.liquidity_operations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all operations"
ON public.liquidity_operations
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Create foreign key constraint
ALTER TABLE public.liquidity_operations
ADD CONSTRAINT fk_liquidity_operations_pool
FOREIGN KEY (pool_id) REFERENCES public.liquidity_pools(id)
ON DELETE CASCADE;

-- Create triggers for updated_at
CREATE TRIGGER update_liquidity_pools_updated_at
BEFORE UPDATE ON public.liquidity_pools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidity_operations_updated_at
BEFORE UPDATE ON public.liquidity_operations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_liquidity_pools_user_id ON public.liquidity_pools(user_id);
CREATE INDEX idx_liquidity_pools_status ON public.liquidity_pools(status);
CREATE INDEX idx_liquidity_pools_token_pair ON public.liquidity_pools(token_a, token_b);
CREATE INDEX idx_liquidity_operations_user_id ON public.liquidity_operations(user_id);
CREATE INDEX idx_liquidity_operations_pool_id ON public.liquidity_operations(pool_id);
CREATE INDEX idx_liquidity_operations_type ON public.liquidity_operations(operation_type);