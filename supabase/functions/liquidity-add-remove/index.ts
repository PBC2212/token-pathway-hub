import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlEncode(input: Uint8Array): string {
  let str = btoa(String.fromCharCode(...input));
  return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncode(new TextEncoder().encode(input));
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [\s\S]*?-----|-----END [\s\S]*?-----|\s/g, '');
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createFireblocksJwt({
  apiKey,
  privateKeyPem,
  uri,
  body,
}: {
  apiKey: string;
  privateKeyPem: string;
  uri: string;
  body: string;
}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 30;
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(body || '');

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { uri, nonce, iat, exp, sub: apiKey, bodyHash };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const privateKey = await importPrivateKey(privateKeyPem);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(dataToSign)));
  const encodedSignature = base64UrlEncode(signature);

  return `${dataToSign}.${encodedSignature}`;
}

interface LiquidityRequest {
  poolId: string;
  action: 'add' | 'remove';
  tokenAAmount: string;
  tokenBAmount: string;
  slippageTolerance?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Liquidity operation request received');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const apiKey = Deno.env.get('FIREBLOCKS_API_KEY');
    const privateKeyPem = Deno.env.get('FIREBLOCKS_PRIVATE_KEY');
    const baseUrl = Deno.env.get('FIREBLOCKS_BASE_URL') || 'https://sandbox-api.fireblocks.io/v1';

    if (!apiKey || !privateKeyPem) {
      console.warn('Fireblocks credentials not configured; proceeding with simulated operation');
    }

    const liquidityData: LiquidityRequest = await req.json();
    console.log('Liquidity operation request:', liquidityData);

    if (!liquidityData.poolId) {
      return new Response(JSON.stringify({ error: 'Invalid request: poolId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pool information
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('liquidity_pools')
      .select('*')
      .eq('id', liquidityData.poolId)
      .maybeSingle();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // For demo purposes, simulate liquidity operation without calling Fireblocks
    console.log('Simulating liquidity operation (Fireblocks vault not configured)');
    const data = {
      id: `mock_tx_${Date.now()}`,
      status: 'PENDING',
      operation: 'CONTRACT_CALL',
      note: `${liquidityData.action} liquidity: ${pool.token_a}/${pool.token_b}`
    };

    // Store liquidity operation in database
    const { data: liquidityRecord, error: dbError } = await supabaseAdmin
      .from('liquidity_operations')
      .insert({
        user_id: user.id,
        pool_id: liquidityData.poolId,
        operation_type: liquidityData.action,
        token_a_amount: liquidityData.tokenAAmount,
        token_b_amount: liquidityData.tokenBAmount,
        fireblocks_tx_id: data.id,
        status: 'pending',
        slippage_tolerance: liquidityData.slippageTolerance || '2.0'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Failed to store liquidity operation',
        fireblocksResponse: data 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      operationId: liquidityRecord.id,
      fireblocksTransaction: data,
      operationInfo: liquidityRecord
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('Error in liquidity-add-remove:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});