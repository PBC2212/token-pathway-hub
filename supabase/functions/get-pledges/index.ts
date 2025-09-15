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

    // Get pledges from Supabase using secure user_id authentication
    // The RLS policies will automatically filter to only show the authenticated user's pledges
    const { data: pledges, error: pledgeError } = await supabase
      .from('pledges')
      .select('*')
      .order('created_at', { ascending: false });

    if (pledgeError) {
      console.error('Error fetching pledges:', pledgeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch pledges',
          details: pledgeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate summary statistics
    const totalPledges = pledges?.length || 0;
    const totalValue = pledges?.reduce((sum, pledge) => sum + Number(pledge.appraised_value), 0) || 0;
    const totalTokens = pledges?.reduce((sum, pledge) => sum + Number(pledge.token_amount), 0) || 0;

    // Group by asset type
    const assetTypeBreakdown = pledges?.reduce((acc, pledge) => {
      const assetType = pledge.asset_type;
      if (!acc[assetType]) {
        acc[assetType] = {
          count: 0,
          totalValue: 0,
          totalTokens: 0
        };
      }
      acc[assetType].count += 1;
      acc[assetType].totalValue += Number(pledge.appraised_value);
      acc[assetType].totalTokens += Number(pledge.token_amount);
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; totalTokens: number }>) || {};

    const response = {
      userId: user.id,
      userEmail: user.email,
      pledges: pledges || [],
      summary: {
        totalPledges,
        totalValue,
        totalTokens,
        assetTypeBreakdown
      },
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
    console.error('Error in get-pledges function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});