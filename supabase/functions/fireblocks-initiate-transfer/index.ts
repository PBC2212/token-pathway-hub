import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferRequest {
  assetId: string;
  source: {
    type: string;
    id?: string;
  };
  destination: {
    type: string;
    id?: string;
  };
  amount: string;
  note?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fireblocks = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await fireblocks.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has permission
    const { data: profile } = await fireblocks
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'user')) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const transferData: TransferRequest = await req.json();

    const fireblocksApiKey = Deno.env.get('FIREBLOCKS_API_KEY');
    if (!fireblocksApiKey) {
      throw new Error('Fireblocks API key not configured');
    }

    // Initiate transfer in Fireblocks
    const response = await fetch('https://api.fireblocks.io/v1/transactions', {
      method: 'POST',
      headers: {
        'X-API-Key': fireblocksApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assetId: transferData.assetId,
        source: transferData.source,
        destination: transferData.destination,
        amount: transferData.amount,
        note: transferData.note || 'Transfer initiated via RWA platform'
      }),
    });

    const transactionData = await response.json();

    if (!response.ok) {
      console.error('Fireblocks API error:', transactionData);
      return new Response(JSON.stringify({ error: transactionData.message || 'Failed to initiate transfer' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Transfer initiated successfully:', transactionData);

    return new Response(JSON.stringify(transactionData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fireblocks-initiate-transfer:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});