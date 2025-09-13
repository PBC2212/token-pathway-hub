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
  const exp = iat + 30; // 30 seconds expiry
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Simulating Fireblocks get vaults operation (development mode)');
    
    // Mock vault data for development
    const mockVaults = {
      accounts: [
        {
          id: "0",
          name: "Main Vault",
          hiddenOnUI: false,
          customerRefId: "main-vault-001",
          autoFuel: true,
          assets: [
            {
              id: "ETH",
              total: "2.5",
              available: "2.5",
              pending: "0",
              frozen: "0",
              lockedAmount: "0"
            },
            {
              id: "USDC", 
              total: "10000.00",
              available: "10000.00",
              pending: "0",
              frozen: "0", 
              lockedAmount: "0"
            },
            {
              id: "BTC",
              total: "0.1",
              available: "0.1",
              pending: "0",
              frozen: "0",
              lockedAmount: "0"
            }
          ]
        },
        {
          id: "1",
          name: "RWA Vault",
          hiddenOnUI: false,
          customerRefId: "rwa-vault-001",
          autoFuel: false,
          assets: [
            {
              id: "ETH",
              total: "1.0", 
              available: "1.0",
              pending: "0",
              frozen: "0",
              lockedAmount: "0"
            },
            {
              id: "USDC",
              total: "5000.00",
              available: "5000.00", 
              pending: "0",
              frozen: "0",
              lockedAmount: "0"
            }
          ]
        }
      ],
      paging: {
        before: null,
        after: null
      }
    };

    return new Response(JSON.stringify(mockVaults), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in fireblocks-get-vaults:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});