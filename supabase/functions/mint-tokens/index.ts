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

Deno.serve(async (req) => {
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
    if (!address || !amount || !assetType || !appraisedValue || !tokenSymbol) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use a default contract address for mock operations
    const contractAddress = mintRequest.contractAddress || '0x1234567890123456789012345678901234567890';

    console.log('Simulating token minting operation (development mode)');
    
    // Mock Fireblocks mint transaction
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
      note: `Minting ${amount} ${tokenSymbol} tokens for ${assetType} asset`,
      extraParameters: {
        contractCallData: {
          contractAddress,
          functionName: 'mint',
          parameters: [
            { type: 'address', value: address },
            { type: 'uint256', value: (amount * Math.pow(10, 18)).toString() },
            { type: 'string', value: assetType },
            { type: 'uint256', value: appraisedValue.toString() }
          ]
        }
      }
    };

    // Store or update pledge record in Supabase
    let pledge: any = null;
    let pledgeError: any = null;

    if (pledgeId) {
      const { data, error } = await supabase
        .from('pledges')
        .update({ 
          tx_hash: fireblocksResult.id,
          token_minted: true 
        })
        .eq('id', pledgeId)
        .select()
        .single();
      pledge = data;
      pledgeError = error;
    } else {
      const { data, error } = await supabase
        .from('pledges')
        .insert({
          user_address: address,
          asset_type: assetType,
          appraised_value: appraisedValue,
          token_amount: amount,
          tx_hash: fireblocksResult.id // Store Fireblocks transaction ID
        })
        .select()
        .single();
      pledge = data;
      pledgeError = error;
    }

    if (pledgeError) {
      console.error('Error storing pledge:', pledgeError);
      // Don't fail the entire request if pledge storage fails
    }

    // Update token balance using enhanced secure function
    const { data: balanceResult, error: balanceError } = await supabase
      .rpc('update_user_token_balance_secure', {
        p_user_address: address,
        p_token_symbol: tokenSymbol,
        p_new_balance: amount,
        p_transaction_reference: fireblocksResult.id,
        p_operation_type: 'token_minting'
      });

    if (balanceError) {
      console.error('Error updating token balance:', balanceError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: fireblocksResult.id,
        pledgeId: pledge?.id,
        message: `Successfully initiated minting of ${amount} ${tokenSymbol} tokens`
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