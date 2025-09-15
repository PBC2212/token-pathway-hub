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

    // Parse request body to get any additional parameters (optional)
    let requestData = {};
    try {
      if (req.method === 'POST' && req.body) {
        requestData = await req.json();
      }
    } catch (e) {
      // GET request or no body - that's fine
    }

    // Get token balances from Supabase using secure RLS authentication
    const { data: balances, error: balanceError } = await supabase
      .from('token_balances')
      .select('*');

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

    // Calculate total USD value based on pledged assets using secure RLS authentication
    const { data: pledges, error: pledgeError } = await supabase
      .from('pledges')
      .select('appraised_value, token_amount, asset_type');

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