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

interface TransferRequest {
  assetId: string;
  source: { type: string; id?: string };
  destination: { type: string; id?: string };
  amount: string;
  note?: string;
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
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const transferData: TransferRequest = await req.json();

    console.log('Simulating Fireblocks transfer operation (development mode)');
    
    // Mock transfer response
    const mockTransactionId = `mock_tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const mockTransfer = {
      id: mockTransactionId,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      assetId: transferData.assetId,
      source: transferData.source,
      destination: transferData.destination,
      amount: transferData.amount,
      networkFee: "0.001",
      netAmount: transferData.amount,
      sourceAddress: "0x7a408cadbC99EE39A0E01f4Cdb10139601163407",
      destinationAddress: "0x7931edfa6255D59AEe5A65D26E6a7e3CF30E8339",
      destinationAddressDescription: "",
      destinationTag: "",
      status: "SUBMITTED",
      txHash: "",
      subStatus: "PENDING_SIGNATURE",
      signedBy: [],
      createdBy: user.id,
      rejectedBy: "",
      amountUSD: "0.00",
      addressType: "",
      note: transferData.note || 'Transfer initiated via RWA platform',
      exchangeTxId: "",
      requestedAmount: transferData.amount,
      serviceFee: "0",
      fee: "0.001",
      feeCurrency: transferData.assetId,
      operation: "TRANSFER",
      customerRefId: "",
      numOfConfirmations: 0,
      amountInfo: {
        amount: transferData.amount,
        requestedAmount: transferData.amount,
        netAmount: transferData.amount,
        amountUSD: "0.00"
      },
      feeInfo: {
        networkFee: "0.001",
        serviceFee: "0"
      },
      signedMessages: []
    };

    return new Response(JSON.stringify(mockTransfer), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in fireblocks-initiate-transfer:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});