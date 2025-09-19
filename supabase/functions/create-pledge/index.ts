import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PledgeRequest {
  user_address: string;
  asset_type: string; // Legacy field for backwards compatibility
  rwa_category: string; // New multi-token category field
  rwa_identifier: string; // Unique asset identifier
  appraised_value: number;
  token_symbol?: string; // Optional, will be determined by category
  contract_address: string;
  description: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
  metadata?: string; // Enhanced metadata field (max 1024 chars)
  ltv_ratio?: number; // LTV in basis points (default 8000 = 80%)
  is_redeemable?: boolean; // Whether asset can be redeemed
}

// MultiToken RWA Category mapping aligned with MultiTokenRwaBackedStablecoin.sol
const RWA_CATEGORY_MAPPING: Record<string, number> = {
  'RealEstate': 0,    // RwaCategory.RealEstate
  'Commodities': 1,   // RwaCategory.Commodities  
  'Bonds': 2,         // RwaCategory.Bonds
  'Equipment': 3,     // RwaCategory.Equipment
  'Inventory': 4,     // RwaCategory.Inventory
  'Other': 5          // RwaCategory.Other
};

// Category Token Mapping (from MultiTokenRwaBackedStablecoin.sol)
const CATEGORY_TOKEN_MAPPING: Record<string, { name: string; symbol: string }> = {
  'RealEstate': { name: 'Real Estate USD', symbol: 'RUSD' },
  'Commodities': { name: 'Commodities USD', symbol: 'CUSD' },
  'Bonds': { name: 'Bonds USD', symbol: 'BUSD' },
  'Equipment': { name: 'Equipment USD', symbol: 'EUSD' },
  'Inventory': { name: 'Inventory USD', symbol: 'IUSD' },
  'Other': { name: 'Other Assets USD', symbol: 'OUSD' }
};

// Legacy asset type to RWA category mapping for backwards compatibility
const LEGACY_ASSET_TYPE_TO_RWA_CATEGORY: Record<string, string> = {
  'real_estate': 'RealEstate',
  'gold': 'Commodities',
  'commodity': 'Commodities', 
  'vehicle': 'Equipment',
  'art': 'Other',
  'equipment': 'Equipment',
  'inventory': 'Inventory',
  'bonds': 'Bonds'
};

// Reverse mapping: RWA category to legacy asset type for proper backwards compatibility
const RWA_CATEGORY_TO_LEGACY_ASSET_TYPE: Record<string, string> = {
  'RealEstate': 'real_estate',
  'Commodities': 'commodity',
  'Bonds': 'bonds',
  'Equipment': 'equipment',
  'Inventory': 'inventory',
  'Other': 'other'
};

// PledgeStatus mapping aligned with MultiTokenRwaBackedStablecoin.sol
const PLEDGE_STATUS_FROM_CONTRACT: Record<number, string> = {
  0: 'pending',     // PledgeStatus.Pending
  1: 'verified',    // PledgeStatus.Verified
  2: 'minted',      // PledgeStatus.Minted
  3: 'rejected',    // PledgeStatus.Rejected
  4: 'cancelled',   // PledgeStatus.Cancelled
  5: 'redeemed',    // PledgeStatus.Redeemed
  6: 'liquidated'   // PledgeStatus.Liquidated
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with anon key to respect RLS policies
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Verify user authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pledgeData: PledgeRequest = await req.json()

    // Normalize and determine RWA category (prioritize new field, fallback to legacy)
    let rwaCategory = pledgeData.rwa_category;
    
    // Normalize RWA category input (case-insensitive, underscore handling)
    if (rwaCategory) {
      const normalizedInput = rwaCategory.trim().toLowerCase().replace(/_/g, '');
      const categoryMap: Record<string, string> = {
        'realestate': 'RealEstate',
        'commodities': 'Commodities',
        'bonds': 'Bonds',
        'equipment': 'Equipment',
        'inventory': 'Inventory',
        'other': 'Other'
      };
      rwaCategory = categoryMap[normalizedInput] || rwaCategory; // Keep original if no match
    }
    
    if (!rwaCategory && pledgeData.asset_type) {
      // Map legacy asset_type to RWA category
      rwaCategory = LEGACY_ASSET_TYPE_TO_RWA_CATEGORY[pledgeData.asset_type] || 'Other';
    }
    
    // Validation
    if (!pledgeData.user_address || !pledgeData.appraised_value || !rwaCategory) {
      throw new Error('Missing required fields: user_address, appraised_value, rwa_category (or legacy asset_type)')
    }

    // Validate RWA identifier is provided
    if (!pledgeData.rwa_identifier || pledgeData.rwa_identifier.trim().length === 0) {
      throw new Error('rwa_identifier is required and must be non-empty')
    }

    // Validate RWA identifier length (contract limit: 256 chars)
    if (pledgeData.rwa_identifier.length > 256) {
      throw new Error('rwa_identifier must be 256 characters or less')
    }

    // Validate RWA category exists in our mapping
    if (!(rwaCategory in RWA_CATEGORY_MAPPING)) {
      throw new Error(`Invalid RWA category: ${rwaCategory}. Valid categories: ${Object.keys(RWA_CATEGORY_MAPPING).join(', ')}`)
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(pledgeData.user_address)) {
      throw new Error('Invalid Ethereum wallet address format')
    }

    // Validate appraised value (aligned with contract MIN_RWA_VALUE = $1,000)
    if (pledgeData.appraised_value < 1000) {
      throw new Error('Minimum appraised value is $1,000')
    }
    
    // Validate appraised value (aligned with contract MAX_RWA_VALUE = $100M)
    if (pledgeData.appraised_value > 100_000_000) {
      throw new Error('Maximum appraised value is $100,000,000')
    }

    // Validate metadata length (contract limit: 1024 chars)
    if (pledgeData.metadata && pledgeData.metadata.length > 1024) {
      throw new Error('metadata must be 1024 characters or less')
    }

    // Validate LTV ratio (basis points: 0-10000)
    const ltvRatio = pledgeData.ltv_ratio || 8000; // Default 80%
    if (ltvRatio < 0 || ltvRatio > 10000) {
      throw new Error('ltv_ratio must be between 0 and 10000 basis points (0% - 100%)')
    }

    // Validate contract address if provided (must match deployed contract)
    const expectedContractAddress = '0x7a408cadbC99EE39A0E01f4Cdb10139601163407';
    if (pledgeData.contract_address && pledgeData.contract_address.toLowerCase() !== expectedContractAddress.toLowerCase()) {
      throw new Error(`Invalid contract address. Expected: ${expectedContractAddress}`)
    }

    // Get category token symbol
    const categoryTokenInfo = CATEGORY_TOKEN_MAPPING[rwaCategory];
    const categoryTokenSymbol = categoryTokenInfo.symbol;

    // Check if blockchain integration is enabled
    const isBlockchainEnabled = !!(
      pledgeData.contract_address && 
      Deno.env.get('FIREBLOCKS_ENABLED') === 'true'
    );

    // Initialize blockchain-related variables
    let blockchainPledgeId: number | null = null;
    let blockchainTxHash: string | null = null;
    let nftTokenId: number | null = null;

    // If blockchain is enabled, prepare for smart contract interaction
    if (isBlockchainEnabled) {
      console.log('Blockchain integration enabled - preparing smart contract call...');
      
      try {
        // Convert RWA category to contract enum
        const contractRwaCategory = RWA_CATEGORY_MAPPING[rwaCategory];
        
        // Convert USD to wei (18 decimals)
        const appraisedValueWei = BigInt(Math.floor(pledgeData.appraised_value * 1e6)) * BigInt(1e12); // Avoid floating point issues
        
        // Prepare enhanced metadata for smart contract (max 1024 chars)
        const enhancedMetadata = pledgeData.metadata || JSON.stringify({
          description: pledgeData.description || '',
          documentHash: pledgeData.document_hash || '',
          appraisalDate: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
          appraiserLicense: pledgeData.appraiser_license || '',
          assetType: pledgeData.asset_type || rwaCategory.toLowerCase()
        }).substring(0, 1024); // Ensure contract limit compliance

        // TODO: Implement actual MultiTokenRwaBackedStablecoin smart contract call via Fireblocks
        // This would call MultiTokenRwaBackedStablecoin.submitPledge() function
        console.log('MultiToken smart contract call parameters:', {
          contractAddress: pledgeData.contract_address,
          rwaIdentifier: pledgeData.rwa_identifier,
          pledger: pledgeData.user_address,
          rwaCategory: contractRwaCategory,
          rwaValueUSD: appraisedValueWei.toString(),
          metadata: enhancedMetadata,
          ltv: ltvRatio,
          isRedeemable: pledgeData.is_redeemable !== false
        });

        // For now, simulate smart contract response
        // In production, replace this with actual Fireblocks integration
        const simulateBlockchainCall = false; // Set to true when Fireblocks is ready
        
        if (simulateBlockchainCall) {
          // Simulated response - replace with actual contract call
          blockchainPledgeId = Math.floor(Date.now() / 1000);
          blockchainTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
          nftTokenId = blockchainPledgeId; // NFT token ID from contract
        }
        
      } catch (contractError) {
        console.error('Smart contract call failed:', contractError);
        console.log('Continuing with database-only storage...');
        // Continue execution - we'll still save to database
      }
    }

    // Generate fallback pledge ID if no blockchain ID
    const pledgeId = blockchainPledgeId || (Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000));

    // Prepare database record with all multi-token fields
    const pledgeRecord = {
      pledge_id: pledgeId,
      user_id: user.id,
      user_address: pledgeData.user_address,
      
      // Legacy fields (for backwards compatibility) - preserve proper legacy values
      asset_type: pledgeData.asset_type || RWA_CATEGORY_TO_LEGACY_ASSET_TYPE[rwaCategory] || 'other',
      
      // Multi-token contract fields (aligned with MultiTokenRwaBackedStablecoin.sol)
      rwa_identifier: pledgeData.rwa_identifier,
      rwa_category: rwaCategory,
      ltv_ratio: ltvRatio,
      metadata: pledgeData.metadata || JSON.stringify({
        description: pledgeData.description || '',
        documentHash: pledgeData.document_hash || '',
        appraisalDate: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
        appraiserLicense: pledgeData.appraiser_license || ''
      }),
      is_redeemable: pledgeData.is_redeemable !== false, // Default true
      
      // Core pledge fields
      appraised_value: pledgeData.appraised_value,
      token_amount: 0, // Will be calculated during approval based on LTV
      token_symbol: pledgeData.token_symbol || categoryTokenSymbol, // Use category token symbol
      category_token_symbol: categoryTokenSymbol, // Store category-specific symbol
      contract_address: pledgeData.contract_address || '',
      description: pledgeData.description || '',
      document_hash: pledgeData.document_hash || '',
      appraisal_date: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
      appraiser_license: pledgeData.appraiser_license || '',
      status: 'pending', // PledgeStatus.Pending in contract
      
      // Blockchain integration fields
      tx_hash: blockchainTxHash,
      nft_token_id: nftTokenId,
      last_valuation_time: new Date().toISOString()
    };

    // Insert into database
    const { data: dbPledge, error: dbError } = await supabase
      .from('pledges')
      .insert(pledgeRecord)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to create pledge record: ${dbError.message}`);
    }

    // Prepare success response
    const response = {
      success: true,
      message: 'Pledge created successfully',
      pledgeId: pledgeId,
      blockchainPledgeId: blockchainPledgeId,
      blockchainTransaction: blockchainTxHash,
      blockchainEnabled: isBlockchainEnabled,
      nftTokenId: nftTokenId,
      data: dbPledge
    };

    console.log('Pledge created successfully:', {
      pledgeId,
      blockchainEnabled: isBlockchainEnabled,
      userId: user.id
    });

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-pledge function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});