import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateVaultRequest {
  name: string;
  hiddenOnUI?: boolean;
  customerRefId?: string;
  autoFuel?: boolean;
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

    // Check if user has permission (admin or user with vault creation rights)
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

    const { name, hiddenOnUI = false, customerRefId, autoFuel = false }: CreateVaultRequest = await req.json();

    const fireblocksApiKey = Deno.env.get('FIREBLOCKS_API_KEY');
    if (!fireblocksApiKey) {
      throw new Error('Fireblocks API key not configured');
    }

    // Create vault in Fireblocks
    const response = await fetch('https://api.fireblocks.io/v1/vault/accounts', {
      method: 'POST',
      headers: {
        'X-API-Key': fireblocksApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        hiddenOnUI,
        customerRefId,
        autoFuel
      }),
    });

    const vaultData = await response.json();

    if (!response.ok) {
      console.error('Fireblocks API error:', vaultData);
      return new Response(JSON.stringify({ error: vaultData.message || 'Failed to create vault' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Vault created successfully:', vaultData);

    return new Response(JSON.stringify(vaultData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fireblocks-create-vault:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});