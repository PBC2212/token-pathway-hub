-- Fix database schema for pledges table
-- First, check if pledges table exists and add missing columns safely
DO $$
BEGIN
    -- Add missing columns to pledges table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'pledge_id') THEN
        ALTER TABLE pledges ADD COLUMN pledge_id INTEGER;
        -- Generate unique pledge_id for existing records without using window functions
        UPDATE pledges SET pledge_id = (EXTRACT(EPOCH FROM created_at)::INTEGER % 1000000) WHERE pledge_id IS NULL;
        ALTER TABLE pledges ALTER COLUMN pledge_id SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS pledges_pledge_id_key ON pledges(pledge_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'user_id') THEN
        ALTER TABLE pledges ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'document_hash') THEN
        ALTER TABLE pledges ADD COLUMN document_hash TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'appraisal_date') THEN
        ALTER TABLE pledges ADD COLUMN appraisal_date DATE DEFAULT CURRENT_DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'appraiser_license') THEN
        ALTER TABLE pledges ADD COLUMN appraiser_license TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'rejection_reason') THEN
        ALTER TABLE pledges ADD COLUMN rejection_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'admin_notes') THEN
        ALTER TABLE pledges ADD COLUMN admin_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'nft_token_id') THEN
        ALTER TABLE pledges ADD COLUMN nft_token_id INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'contract_address') THEN
        ALTER TABLE pledges ADD COLUMN contract_address TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'token_symbol') THEN
        ALTER TABLE pledges ADD COLUMN token_symbol TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'description') THEN
        ALTER TABLE pledges ADD COLUMN description TEXT DEFAULT '';
    END IF;
END $$;

-- Create blockchain_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  transaction_type TEXT NOT NULL,
  user_address TEXT,
  contract_address TEXT,
  transaction_data JSONB,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on both tables
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for pledges
DROP POLICY IF EXISTS "Users can view own pledges" ON pledges;
DROP POLICY IF EXISTS "Users can create pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can manage all pledges" ON pledges;

CREATE POLICY "Authenticated users can view their own pledges" ON pledges 
  FOR SELECT USING (auth.uid() = user_id OR auth.uid()::text = user_address);

CREATE POLICY "Authenticated users can create pledges" ON pledges 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid()::text = user_address);

CREATE POLICY "Admins can manage all pledges" ON pledges 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- RLS policies for blockchain_transactions
DROP POLICY IF EXISTS "Admins can manage transactions" ON blockchain_transactions;
DROP POLICY IF EXISTS "Users can view their transactions" ON blockchain_transactions;

CREATE POLICY "Admins can manage all transactions" ON blockchain_transactions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can view their own transactions" ON blockchain_transactions 
  FOR SELECT USING (auth.uid()::text = user_address);

-- Create admin user function
CREATE OR REPLACE FUNCTION create_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if admin user exists, if not create one
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    -- This would typically be done when the first admin signs up
    -- For now, we'll just ensure the function exists
    NULL;
  END IF;
END;
$$;