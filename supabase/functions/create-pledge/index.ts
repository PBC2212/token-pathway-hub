import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PledgeRequest {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description?: string;
}

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

    // Parse request body
    const pledgeRequest: PledgeRequest = await req.json();
    const { user_address, asset_type, appraised_value, token_symbol, contract_address, description } = pledgeRequest;

    // Validate input
    if (!user_address || !asset_type || !appraised_value || !token_symbol || !contract_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating pledge for asset:', asset_type, 'valued at:', appraised_value);
    
    // Calculate token amount (1:1 ratio with USD value)
    const tokenAmount = appraised_value;

    // Store pledge record in Supabase with pending status
    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .insert({
        user_address,
        asset_type,
        appraised_value,
        token_amount: tokenAmount,
        status: 'pending'
      })
      .select()
      .single();

    if (pledgeError) {
      console.error('Error storing pledge:', pledgeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create pledge',
          details: pledgeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        pledgeId: pledge.id,
        status: pledge.status,
        message: `Successfully created pledge for ${asset_type} worth $${appraised_value.toLocaleString()}. Awaiting admin approval.`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in create-pledge function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});