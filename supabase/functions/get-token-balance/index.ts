import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Initialize Supabase client with service role key for hybrid setup (Supabase Auth + Neon DB)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication using the provided JWT
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await authClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body to get any additional parameters (optional)
    let requestData = {};
    try {
      if (req.method === 'POST' && req.body) {
        requestData = await req.json();
      }
    } catch (e) {
      // GET request or no body - that's fine
    }

    // CRITICAL SECURITY FIX: Get token balances by user_id instead of wallet_address
    // This prevents users from seeing other users' token balances even if they spoof wallet addresses
    const { data: balances, error: balanceError } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_id', user.id); // SECURE: Filter by authenticated user_id only
      
    // SECURITY VALIDATION: Final check all returned data belongs to requesting user
    if (balances) {
      const invalidBalances = balances.filter(balance => balance.user_id !== user.id);
      if (invalidBalances.length > 0) {
        console.error('SECURITY BREACH DETECTED: Found balances not belonging to user', {
          userId: user.id,
          invalidCount: invalidBalances.length
        });
        return new Response(
          JSON.stringify({ error: 'Data validation failed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (balanceError) {
      console.error('Error fetching token balances:', balanceError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch token balances',
          details: balanceError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Calculate total USD value ONLY from this user's pledged assets
    const { data: pledges, error: pledgeError } = await supabase
      .from('pledges')
      .select('appraised_value, token_amount, asset_type')
      .eq('user_id', user.id); // CRITICAL: Filter by user_id to prevent data leakage

    let totalUsdValue = 0;
    if (!pledgeError && pledges) {
      totalUsdValue = pledges.reduce((sum, pledge) => sum + Number(pledge.appraised_value), 0);
    }

    const response = {
      userId: user.id,
      userEmail: user.email,
      balances: balances || [],
      totalUsdValue,
      lastUpdated: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-token-balance function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});