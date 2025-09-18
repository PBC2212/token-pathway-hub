import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Utility functions for JWT creation (same as in other Fireblocks functions)
function base64UrlEncode(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncode(new TextEncoder().encode(input));
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createFireblocksJwt({
  apiKey,
  privateKeyPem,
  uri,
  body
}: {
  apiKey: string;
  privateKeyPem: string;
  uri: string;
  body: string;
}): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uri,
    nonce: crypto.randomUUID(),
    iat: now,
    exp: now + 30,
    sub: apiKey,
    bodyHash: await sha256Hex(body)
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

interface MintRequest {
  address: string;
  amount: number;
  assetType: string;
  appraisedValue: number;
  contractAddress?: string;
  tokenSymbol: string;
  pledgeId?: string;
  category?: string; // RWA Category for multi-token system
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const mintRequest: MintRequest = await req.json();
    const { address, amount, assetType, appraisedValue, tokenSymbol, pledgeId } = mintRequest;

    // Validate input
    if (!address || !amount || !assetType || !appraisedValue || !tokenSymbol || !pledgeId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields. PledgeId is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL SECURITY: Validate pledge ownership, status, and minting eligibility
    const { data: pledgeData, error: pledgeError } = await supabase
      .from('pledges')
      .select('*')
      .eq('id', pledgeId)
      .eq('user_id', user.id) // Ensure user owns the pledge
      .eq('status', 'approved') // Only approved pledges
      .eq('token_minted', false) // Not already minted
      .single();

    if (pledgeError || !pledgeData) {
      return new Response(
        JSON.stringify({ 
          error: pledgeError ? 'Pledge not found or access denied' : 'Pledge not eligible for minting',
          details: 'Only your own approved, unminted pledges can be used for token minting'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that the request data matches the pledge data (normalize addresses)
    const pledgeAddress = pledgeData.user_address.toLowerCase();
    const requestAddress = address.toLowerCase();
    
    if (pledgeAddress !== requestAddress || pledgeData.asset_type !== assetType) {
      return new Response(
        JSON.stringify({ 
          error: 'Request data does not match pledge data',
          details: 'Address and asset type must match the approved pledge'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MULTI-TOKEN: Normalize and determine category from DATABASE ONLY (MultiTokenRwaBackedStablecoin.sol)
    const rawCategory = pledgeData.rwa_category || 'Other';
    
    // Normalize category to handle case variations and underscores
    const normalizeCategory = (category: string): string => {
      const normalized = category.toLowerCase().replace(/[_\s-]/g, '');
      const mapping: Record<string, string> = {
        'realestate': 'RealEstate',
        'commodities': 'Commodities', 
        'bonds': 'Bonds',
        'equipment': 'Equipment',
        'inventory': 'Inventory',
        'other': 'Other'
      };
      return mapping[normalized] || 'Other';
    };
    
    const dbCategory = normalizeCategory(rawCategory); // Only trust DB value for category
    const categoryTokenMap: Record<string, { name: string; symbol: string; }> = {
      'RealEstate': { name: 'Real Estate USD', symbol: 'RUSD' },
      'Commodities': { name: 'Commodities USD', symbol: 'CUSD' },
      'Bonds': { name: 'Bonds USD', symbol: 'BUSD' },
      'Equipment': { name: 'Equipment USD', symbol: 'EUSD' },
      'Inventory': { name: 'Inventory USD', symbol: 'IUSD' },
      'Other': { name: 'Other Assets USD', symbol: 'OUSD' }
    };
    
    // CRITICAL SECURITY: Calculate amount using ONLY database values with proper numeric handling
    const ltvRatio = parseInt(String(pledgeData.ltv_ratio || '8000')) || 8000; // Default 80% LTV (8000 basis points)
    const dbAppraisedValue = parseFloat(String(pledgeData.appraised_value || '0')) || 0; // Handle Postgres numeric strings
    const dbTokenAmount = parseFloat(String(pledgeData.token_amount || '0')) || 0; // Handle Postgres numeric strings
    const reserveRatio = 500; // 5% reserves (basis points) - matches contract
    
    console.log('mint-tokens: Database values - category:', rawCategory, '-> normalized:', dbCategory, 
                'appraised_value:', dbAppraisedValue, 'ltv_ratio:', ltvRatio, 'token_amount:', dbTokenAmount);
    
    // Server-side calculation using ONLY database values (preventing client manipulation)
    const serverCalculatedAmount = Math.floor(dbAppraisedValue * (ltvRatio / 10000));
    const reserveAmount = Math.floor(serverCalculatedAmount * (reserveRatio / 10000)); // Treasury reserves
    const categoryTokenInfo = categoryTokenMap[dbCategory] || categoryTokenMap['Other'];
    const serverTokenSymbol = categoryTokenInfo.symbol;
    
    // Reject if client tries to manipulate amounts or symbols
    if (Math.abs(amount - serverCalculatedAmount) > 0.01 || tokenSymbol !== serverTokenSymbol) {
      return new Response(
        JSON.stringify({ 
          error: 'Amount or token symbol manipulation detected',
          details: `Expected amount: ${serverCalculatedAmount} (${ltvRatio/100}% LTV), token: ${serverTokenSymbol}`,
          provided: { amount, tokenSymbol },
          calculation: { dbAppraisedValue, ltvRatio, expectedAmount: serverCalculatedAmount }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use a default contract address for mock operations
    const contractAddress = mintRequest.contractAddress || '0x1234567890123456789012345678901234567890';

    console.log('Simulating token minting operation (development mode)');
    
    // Mock category-specific token addresses (proper hex format)
    const mockCategoryTokenAddresses: Record<string, string> = {
      'RealEstate': '0x1000000000000000000000000000000000000001', // RUSD token
      'Commodities': '0x2000000000000000000000000000000000000002', // CUSD token
      'Bonds': '0x3000000000000000000000000000000000000003', // BUSD token
      'Equipment': '0x4000000000000000000000000000000000000004', // EUSD token
      'Inventory': '0x5000000000000000000000000000000000000005', // IUSD token
      'Other': '0x6000000000000000000000000000000000000006' // OUSD token
    };
    
    const categoryTokenAddress = mockCategoryTokenAddresses[dbCategory] || mockCategoryTokenAddresses['Other'];
    
    // Mock MultiTokenRwaBackedStablecoin transaction using server-calculated values
    const mockTransactionId = `mock_multitoken_mint_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fireblocksResult = {
      id: mockTransactionId,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      assetId: 'ETH',
      source: {
        type: 'VAULT_ACCOUNT',
        id: '0',
        name: 'Main Vault'
      },
      destination: {
        type: 'EXTERNAL_WALLET',
        oneTimeAddress: {
          address: contractAddress // Main contract address
        }
      },
      amount: '0', // Contract call, no ETH transfer
      networkFee: '0.002',
      status: 'SUBMITTED',
      txHash: '',
      subStatus: 'PENDING_SIGNATURE',
      operation: 'CONTRACT_CALL',
      note: `Minting ${serverCalculatedAmount} ${serverTokenSymbol} tokens for ${dbCategory} (${assetType}) asset`,
      extraParameters: {
        contractCallData: {
          contractAddress, // Main MultiTokenRwaBackedStablecoin contract
          functionName: 'mintStablecoins',
          parameters: [
            { type: 'uint256', value: pledgeData.pledge_id?.toString() || '0' } // Only pledgeId needed in new contract
          ]
        },
        categoryTokenMint: {
          tokenAddress: categoryTokenAddress, // Category-specific token contract
          tokenSymbol: serverTokenSymbol,
          userMint: (serverCalculatedAmount * Math.pow(10, 18)).toString(),
          treasuryReserves: (reserveAmount * Math.pow(10, 18)).toString(),
          category: dbCategory
        }
      }
    };

    // Securely update the validated pledge record
    const { data: updatedPledge, error: pledgeUpdateError } = await supabase
      .from('pledges')
      .update({ 
        tx_hash: fireblocksResult.id,
        token_minted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', pledgeId)
      .eq('user_id', user.id) // Double-check ownership on update
      .eq('token_minted', false) // Ensure it wasn't already minted (prevent race conditions)
      .select()
      .single();

    if (pledgeUpdateError || !updatedPledge) {
      console.error('Error updating pledge:', pledgeUpdateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update pledge record',
          details: 'Pledge may have already been minted or access denied'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update token balance using enhanced secure function with server values
    const { data: balanceResult, error: balanceError } = await supabase
      .rpc('update_user_token_balance_secure', {
        p_user_address: pledgeData.user_address,
        p_token_symbol: serverTokenSymbol,
        p_new_balance: serverCalculatedAmount,
        p_transaction_reference: fireblocksResult.id,
        p_operation_type: 'token_minting'
      });

    // CRITICAL: If balance update fails, rollback the pledge update
    if (balanceError) {
      console.error('Error updating token balance:', balanceError);
      
      // Rollback pledge to unminted state
      try {
        await supabase
          .from('pledges')
          .update({ 
            token_minted: false,
            tx_hash: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', pledgeId)
          .eq('user_id', user.id);
        
        console.log('Rolled back pledge due to balance update failure');
      } catch (rollbackError) {
        console.error('CRITICAL: Failed to rollback pledge after balance error:', rollbackError);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Token balance update failed',
          details: 'Minting operation was rolled back. Please try again.',
          balanceError: balanceError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: fireblocksResult.id,
        pledgeId: updatedPledge.id,
        balanceResult: balanceResult,
        message: `Successfully minted ${serverCalculatedAmount} ${serverTokenSymbol} tokens for ${dbCategory} (${assetType}) asset`,
        details: {
          // Multi-token system details
          category: dbCategory,
          categoryTokenAddress: categoryTokenAddress,
          categoryTokenName: categoryTokenInfo.name,
          tokenSymbol: serverTokenSymbol,
          
          // Amounts
          userTokenAmount: serverCalculatedAmount,
          reserveAmount: reserveAmount,
          totalMinted: serverCalculatedAmount + reserveAmount,
          
          // Asset details
          assetType: assetType,
          appraisedValue: dbAppraisedValue,
          ltv: `${ltvRatio/100}%`,
          ltvRatio: ltvRatio,
          
          // System info
          contractType: 'MultiTokenRwaBackedStablecoin',
          fireblocksMode: 'mock'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in mint-tokens function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});