-- Add columns to existing profiles table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'wallet_address') THEN
        ALTER TABLE profiles ADD COLUMN wallet_address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
    END IF;
END $$;

-- Create pledges table with updated schema
CREATE TABLE IF NOT EXISTS pledges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pledge_id INTEGER UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  appraised_value DECIMAL NOT NULL,
  token_symbol TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  description TEXT NOT NULL,
  document_hash TEXT NOT NULL,
  appraisal_date DATE NOT NULL,
  appraiser_license TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  token_amount DECIMAL,
  nft_token_id INTEGER,
  rejection_reason TEXT,
  admin_notes TEXT
);

-- Create blockchain transactions table
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

-- Enable RLS
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for pledges
DROP POLICY IF EXISTS "Users can view own pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can view all pledges" ON pledges;
DROP POLICY IF EXISTS "Users can create pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can manage pledges" ON pledges;

CREATE POLICY "Users can view own pledges" ON pledges 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pledges" ON pledges 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create pledges" ON pledges 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage pledges" ON pledges 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create policies for blockchain_transactions
DROP POLICY IF EXISTS "Admins can manage transactions" ON blockchain_transactions;

CREATE POLICY "Admins can manage transactions" ON blockchain_transactions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pledges_updated_at ON pledges;
CREATE TRIGGER update_pledges_updated_at
    BEFORE UPDATE ON pledges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();