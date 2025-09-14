-- Clean up and recreate RLS policies properly
-- Drop all existing policies first
DROP POLICY IF EXISTS "Authenticated users can view their own pledges" ON pledges;
DROP POLICY IF EXISTS "Authenticated users can create pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can manage all pledges" ON pledges;
DROP POLICY IF EXISTS "Users can view own pledges" ON pledges;
DROP POLICY IF EXISTS "Users can create pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can view all pledges" ON pledges;

-- Recreate proper RLS policies for pledges
CREATE POLICY "pledge_select_own" ON pledges 
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid()::text = user_address OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "pledge_insert_own" ON pledges 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid()::text = user_address);

CREATE POLICY "pledge_update_admin" ON pledges 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "pledge_delete_admin" ON pledges 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Clean up blockchain_transactions policies
DROP POLICY IF EXISTS "Admins can manage all transactions" ON blockchain_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON blockchain_transactions;
DROP POLICY IF EXISTS "Admins can manage transactions" ON blockchain_transactions;

-- Recreate blockchain_transactions policies
CREATE POLICY "transaction_select_own_or_admin" ON blockchain_transactions 
  FOR SELECT USING (
    auth.uid()::text = user_address OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "transaction_insert_admin" ON blockchain_transactions 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "transaction_update_admin" ON blockchain_transactions 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Add trigger for updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to pledges table
DROP TRIGGER IF EXISTS update_pledges_updated_at ON pledges;
CREATE TRIGGER update_pledges_updated_at
    BEFORE UPDATE ON pledges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();