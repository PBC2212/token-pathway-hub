import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Smart contract configuration
const PLEDGE_ESCROW_ADDRESS = Deno.env.get('PLEDGE_ESCROW_ADDRESS') || '';
const FIREBLOCKS_API_KEY = Deno.env.get('FIREBLOCKS_API_KEY') || '';
const FIREBLOCKS_PRIVATE_KEY = Deno.env.get('FIREBLOCKS_PRIVATE_KEY') || '';
const FIREBLOCKS_BASE_URL = Deno.env.get('FIREBLOCKS_BASE_URL') || 'https://api.fireblocks.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PledgeRequest {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  asset_name: string;
  asset_description: string;
  asset_location: string;
  appraisal_document: string;
  additional_documents?: string[];
}

// Asset type mapping for smart contract enum
const ASSET_TYPE_MAPPING: { [key: string]: number } = {
  'real_estate': 0,
  'gold': 1,
  'vehicle': 2,
  'art': 3,
  'equipment': 4,
  'commodity': 5
};

// Utility functions for Fireblocks JWT creation
function base64UrlEncode(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length).replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

async function createFireblocksJwt({
  path,
  bodyJson = '',
  apiKey,
  privateKey
}: {
  path: string;
  bodyJson?: string;
  apiKey: string;
  privateKey: string;
}): Promise<string> {
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyHash = await sha256Hex(bodyJson);
  
  const payload = {
    uri: path,
    nonce,
    iat: timestamp,
    exp: timestamp + 55,
    sub: apiKey,
    bodyHash
  };
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  
  const message = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(message));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  
  return `${message}.${encodedSignature}`;
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

    // Validate environment variables
    if (!PLEDGE_ESCROW_ADDRESS || !FIREBLOCKS_API_KEY || !FIREBLOCKS_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Smart contract or Fireblocks configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const pledgeRequest: PledgeRequest = await req.json();
    const { 
      user_address, 
      asset_type, 
      appraised_value, 
      asset_name, 
      asset_description, 
      asset_location,
      appraisal_document,
      additional_documents = []
    } = pledgeRequest;

    // Validate input
    if (!user_address || !asset_type || !appraised_value || !asset_name || !appraisal_document) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate asset type
    const assetTypeEnum = ASSET_TYPE_MAPPING[asset_type.toLowerCase()];
    if (assetTypeEnum === undefined) {
      return new Response(
        JSON.stringify({ error: 'Invalid asset type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating on-chain pledge for asset:', asset_type, 'valued at:', appraised_value);
    
    // Create document hash for blockchain storage
    const documentHash = await sha256Hex(JSON.stringify({
      appraisal_document,
      additional_documents,
      asset_name,
      asset_description,
      asset_location
    }));

    // Prepare smart contract call data for PledgeEscrow.createPledge()
    const contractCallData = {
      contractAddress: PLEDGE_ESCROW_ADDRESS,
      functionName: 'createPledge',
      parameters: [
        assetTypeEnum, // AssetType enum
        (appraised_value * 1e18).toString(), // Convert to wei (18 decimals)
        {
          name: asset_name,
          description: asset_description,
          location: asset_location,
          appraisedValue: (appraised_value * 1e18).toString(),
          appraisalDocument: appraisal_document,
          additionalDocuments: additional_documents,
          documentHash: `0x${documentHash}`
        }
      ]
    };

    // Create Fireblocks transaction
    const transactionPayload = {
      assetId: 'ETH', // Or the appropriate blockchain asset
      source: {
        type: 'VAULT_ACCOUNT',
        id: '0' // Your vault ID
      },
      destination: {
        type: 'EXTERNAL_WALLET',
        id: user_address
      },
      operation: 'CONTRACT_CALL',
      extraParameters: {
        contractCallData: JSON.stringify(contractCallData)
      },
      note: `Create pledge for ${asset_name} - ${asset_type}`
    };

    // Sign and send transaction via Fireblocks
    const jwt = await createFireblocksJwt({
      path: '/v1/transactions',
      bodyJson: JSON.stringify(transactionPayload),
      apiKey: FIREBLOCKS_API_KEY,
      privateKey: FIREBLOCKS_PRIVATE_KEY
    });

    const fireblocksResponse = await fetch(`${FIREBLOCKS_BASE_URL}/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'X-API-Key': FIREBLOCKS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transactionPayload)
    });

    if (!fireblocksResponse.ok) {
      const errorText = await fireblocksResponse.text();
      console.error('Fireblocks API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create blockchain transaction',
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transactionResult = await fireblocksResponse.json();
    console.log('Fireblocks transaction created:', transactionResult.id);

    // Store pledge record in Supabase with transaction details
    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .insert({
        user_address,
        asset_type,
        appraised_value,
        token_amount: appraised_value, // 1:1 ratio initially
        status: 'pending',
        tx_hash: transactionResult.id, // Store Fireblocks transaction ID
        // Store additional metadata for the pledge
        asset_metadata: {
          name: asset_name,
          description: asset_description,
          location: asset_location,
          appraisal_document,
          additional_documents,
          document_hash: documentHash
        }
      })
      .select()
      .single();

    if (pledgeError) {
      console.error('Error storing pledge:', pledgeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to store pledge record',
          details: pledgeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        pledgeId: pledge.id,
        transactionId: transactionResult.id,
        status: pledge.status,
        nftWillBeCreated: true,
        message: `Successfully created on-chain pledge for ${asset_name} worth $${appraised_value.toLocaleString()}. NFT will be minted and held in escrow. Awaiting admin approval.`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-pledge function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});