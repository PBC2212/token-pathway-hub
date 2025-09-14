-- Add missing columns to existing pledges table
DO $$
BEGIN
    -- Add user_id column for auth.users reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'user_id') THEN
        ALTER TABLE pledges ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add pledge_id for unique identification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'pledge_id') THEN
        ALTER TABLE pledges ADD COLUMN pledge_id INTEGER;
        -- Generate unique pledge_ids for existing records
        UPDATE pledges SET pledge_id = (EXTRACT(EPOCH FROM created_at)::INTEGER % 1000000) WHERE pledge_id IS NULL;
        ALTER TABLE pledges ALTER COLUMN pledge_id SET NOT NULL;
        CREATE UNIQUE INDEX pledges_pledge_id_idx ON pledges(pledge_id);
    END IF;
    
    -- Add token_symbol
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'token_symbol') THEN
        ALTER TABLE pledges ADD COLUMN token_symbol TEXT DEFAULT '';
    END IF;
    
    -- Add contract_address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'contract_address') THEN
        ALTER TABLE pledges ADD COLUMN contract_address TEXT DEFAULT '';
    END IF;
    
    -- Add description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'description') THEN
        ALTER TABLE pledges ADD COLUMN description TEXT DEFAULT '';
    END IF;
    
    -- Add document_hash
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'document_hash') THEN
        ALTER TABLE pledges ADD COLUMN document_hash TEXT DEFAULT '';
    END IF;
    
    -- Add appraisal_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'appraisal_date') THEN
        ALTER TABLE pledges ADD COLUMN appraisal_date DATE DEFAULT CURRENT_DATE;
    END IF;
    
    -- Add appraiser_license
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'appraiser_license') THEN
        ALTER TABLE pledges ADD COLUMN appraiser_license TEXT;
    END IF;
    
    -- Add rejection_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'rejection_reason') THEN
        ALTER TABLE pledges ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- Add nft_token_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'nft_token_id') THEN
        ALTER TABLE pledges ADD COLUMN nft_token_id INTEGER;
    END IF;
END $$;

-- Now create RLS policies using the correct column names
DROP POLICY IF EXISTS "pledge_select_own" ON pledges;
DROP POLICY IF EXISTS "pledge_insert_own" ON pledges;
DROP POLICY IF EXISTS "pledge_update_admin" ON pledges;
DROP POLICY IF EXISTS "pledge_delete_admin" ON pledges;

-- Create new policies with proper logic
CREATE POLICY "pledge_select_policy" ON pledges 
  FOR SELECT USING (
    auth.uid()::text = user_address OR
    (user_id IS NOT NULL AND auth.uid() = user_id) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "pledge_insert_policy" ON pledges 
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_address OR
    (user_id IS NOT NULL AND auth.uid() = user_id)
  );

CREATE POLICY "pledge_update_policy" ON pledges 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "pledge_delete_policy" ON pledges 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );