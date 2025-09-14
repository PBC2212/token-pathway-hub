-- Update pledges table structure to match existing schema
-- First check if the table already exists with data
DO $$
BEGIN
    -- Update existing pledges table or create if not exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pledges') THEN
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pledges' AND column_name = 'pledge_id') THEN
            ALTER TABLE pledges ADD COLUMN pledge_id INTEGER;
            -- Update existing records with unique pledge_id
            UPDATE pledges SET pledge_id = (EXTRACT(EPOCH FROM created_at)::INTEGER + ROW_NUMBER() OVER (ORDER BY created_at)) WHERE pledge_id IS NULL;
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
    ELSE
        -- Create new pledges table
        CREATE TABLE pledges (
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
    END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely
DROP POLICY IF EXISTS "Users can view own pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can view all pledges" ON pledges;
DROP POLICY IF EXISTS "Users can create pledges" ON pledges;
DROP POLICY IF EXISTS "Admins can manage pledges" ON pledges;

-- Create new policies
CREATE POLICY "Users can view own pledges" ON pledges 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create pledges" ON pledges 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all pledges" ON pledges 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );