import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PledgeRequest {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
}

// Asset type mapping between frontend strings and smart contract enums
const ASSET_TYPE_MAPPING: Record<string, number> = {
  'real_estate': 0,    // AssetType.RealEstate
  'gold': 1,           // AssetType.Gold
  'vehicle': 2,        // AssetType.Vehicle
  'art': 3,            // AssetType.Art
  'equipment': 4,      // AssetType.Equipment
  'commodity': 5       // AssetType.Commodity
};

// Status mapping between contract enums and database strings
const STATUS_FROM_CONTRACT: Record<number, string> = {
  0: 'pending',    // PledgeStatus.Pending
  1: 'approved',   // PledgeStatus.Approved
  2: 'rejected',   // PledgeStatus.Rejected
  3: 'redeemed',   // PledgeStatus.Redeemed
  4: 'defaulted'   // PledgeStatus.Defaulted
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const pledgeData: PledgeRequest = await req.json()

    // Validation
    if (!pledgeData.user_address || !pledgeData.asset_type || !pledgeData.appraised_value) {
      throw new Error('Missing required fields: user_address, asset_type, appraised_value')
    }

    // Validate asset type exists in our mapping
    if (!(pledgeData.asset_type in ASSET_TYPE_MAPPING)) {
      throw new Error(`Invalid asset type: ${pledgeData.asset_type}. Valid types: ${Object.keys(ASSET_TYPE_MAPPING).join(', ')}`)
    }

    // Validate wallet address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(pledgeData.user_address)) {
      throw new Error('Invalid Ethereum wallet address format')
    }

    // Validate appraised value
    if (pledgeData.appraised_value < 1000) {
      throw new Error('Minimum appraised value is $1,000')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

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
        // Convert asset type to contract enum
        const contractAssetType = ASSET_TYPE_MAPPING[pledgeData.asset_type];
        
        // Convert USD to wei (18 decimals)
        const appraisedValueWei = BigInt(Math.floor(pledgeData.appraised_value * 1e6)) * BigInt(1e12); // Avoid floating point issues
        
        // Prepare asset metadata for smart contract
        const assetMetadata = {
          description: pledgeData.description || '',
          documentHash: pledgeData.document_hash || '0x0000000000000000000000000000000000000000000000000000000000000000',
          appraisalDate: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
          appraiserLicense: pledgeData.appraiser_license || ''
        };

        // TODO: Implement actual smart contract call via Fireblocks
        // This would call your PledgeEscrow.createPledge() function
        console.log('Smart contract call parameters:', {
          contractAddress: pledgeData.contract_address,
          assetType: contractAssetType,
          appraisedValue: appraisedValueWei.toString(),
          metadata: assetMetadata
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

    // Prepare database record with all required fields - INCLUDING pledge_id
    const pledgeRecord = {
      pledge_id: pledgeId,  // FIXED: Add the missing pledge_id field
      user_id: user.id,
      user_address: pledgeData.user_address,
      asset_type: pledgeData.asset_type, // Store frontend string value
      asset_type_contract_id: ASSET_TYPE_MAPPING[pledgeData.asset_type], // Store contract enum
      appraised_value: pledgeData.appraised_value,
      token_amount: 0, // Will be set during approval process
      token_symbol: pledgeData.token_symbol || `${pledgeData.asset_type.toUpperCase().substring(0,3)}${pledgeId}`,
      contract_address: pledgeData.contract_address || '',
      description: pledgeData.description || '',
      document_hash: pledgeData.document_hash || '',
      appraisal_date: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
      appraiser_license: pledgeData.appraiser_license || '',
      status: 'pending',
      blockchain_pledge_id: blockchainPledgeId,
      blockchain_tx_hash: blockchainTxHash,
      blockchain_enabled: isBlockchainEnabled,
      nft_token_id: nftTokenId
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