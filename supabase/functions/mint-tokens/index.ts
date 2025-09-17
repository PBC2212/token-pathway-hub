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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // CRITICAL SECURITY: Calculate amount and token symbol server-side from pledge data
    const serverCalculatedAmount = Math.floor((pledgeData.appraised_value || 0) * 0.8); // 80% LTV
    const serverTokenSymbol = pledgeData.token_symbol || 'RWA';
    
    // Reject if client tries to manipulate amounts or symbols
    if (Math.abs(amount - serverCalculatedAmount) > 0.01 || tokenSymbol !== serverTokenSymbol) {
      return new Response(
        JSON.stringify({ 
          error: 'Amount or token symbol manipulation detected',
          details: `Expected amount: ${serverCalculatedAmount}, token: ${serverTokenSymbol}`,
          provided: { amount, tokenSymbol }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use a default contract address for mock operations
    const contractAddress = mintRequest.contractAddress || '0x1234567890123456789012345678901234567890';

    console.log('Simulating token minting operation (development mode)');
    
    // Mock Fireblocks mint transaction using server-calculated values
    const mockTransactionId = `mock_mint_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
          address: contractAddress
        }
      },
      amount: '0', // Contract call, no ETH transfer
      networkFee: '0.002',
      status: 'SUBMITTED',
      txHash: '',
      subStatus: 'PENDING_SIGNATURE',
      operation: 'CONTRACT_CALL',
      note: `Minting ${serverCalculatedAmount} ${serverTokenSymbol} tokens for ${assetType} asset`,
      extraParameters: {
        contractCallData: {
          contractAddress,
          functionName: 'mint',
          parameters: [
            { type: 'address', value: pledgeData.user_address },
            { type: 'uint256', value: (serverCalculatedAmount * Math.pow(10, 18)).toString() },
            { type: 'string', value: assetType },
            { type: 'uint256', value: pledgeData.appraised_value.toString() }
          ]
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
        message: `Successfully minted ${serverCalculatedAmount} ${serverTokenSymbol} tokens for ${assetType} asset`,
        details: {
          assetType: assetType,
          appraisedValue: pledgeData.appraised_value,
          tokenAmount: serverCalculatedAmount,
          tokenSymbol: serverTokenSymbol,
          ltv: '80%',
          fireblocksMode: 'mock' // Indicate mock mode since no real API keys
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