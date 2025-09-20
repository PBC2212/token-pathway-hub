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

    // Initialize Supabase client with anon key for user-level RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify user authentication using the provided JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Get token balances by user_address matching authenticated user
    // This uses RLS policies to ensure only user's own data is returned
    const { data: balances, error: balanceError } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_address', user.id); // Use user.id as user_address for security
      
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

    // SECURITY VALIDATION: Ensure all returned data belongs to requesting user
    if (balances) {
      const invalidBalances = balances.filter(balance => 
        balance.user_address !== user.id
      );
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

    // Calculate total USD value from user's own pledged assets only
    const { data: pledges, error: pledgeError } = await supabase
      .from('pledges')
      .select('appraised_value')
      .eq('user_id', user.id); // RLS ensures only user's pledges are returned

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
    console.error('Error in get-token-balance-user-only function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});