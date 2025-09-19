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

    // Get user's wallet address for filtering token balances
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch user profile',
          details: profileError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Get only this user's token balances by wallet address
    const userWalletAddress = userProfile.wallet_address;
    if (!userWalletAddress) {
      return new Response(
        JSON.stringify({ 
          error: 'No wallet address found for user',
          balances: [],
          totalUsdValue: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: balances, error: balanceError } = await supabase
      .from('token_balances')
      .select('*')
      .eq('user_address', userWalletAddress);
      
    // SECURITY VALIDATION: Ensure all returned balances belong to user's wallet
    if (balances) {
      const invalidBalances = balances.filter(balance => balance.user_address !== userWalletAddress);
      if (invalidBalances.length > 0) {
        console.error('SECURITY BREACH DETECTED: Found balances not belonging to user wallet', {
          userId: user.id,
          userWallet: userWalletAddress,
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