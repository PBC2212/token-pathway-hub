import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const fireblocksApiKey = Deno.env.get('FIREBLOCKS_API_KEY');
    if (!fireblocksApiKey) {
      throw new Error('Fireblocks API key not configured');
    }

    // Get vaults from Fireblocks
    const response = await fetch('https://api.fireblocks.io/v1/vault/accounts_paged', {
      method: 'GET',
      headers: {
        'X-API-Key': fireblocksApiKey,
        'Content-Type': 'application/json',
      },
    });

    const vaultsData = await response.json();

    if (!response.ok) {
      console.error('Fireblocks API error:', vaultsData);
      return new Response(JSON.stringify({ error: vaultsData.message || 'Failed to fetch vaults' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Vaults fetched successfully:', vaultsData);

    return new Response(JSON.stringify(vaultsData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fireblocks-get-vaults:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});