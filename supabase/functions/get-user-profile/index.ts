import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create supabase client
    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
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

    const requestData = await req.json().catch(() => ({}));
    const operation = requestData.operation || 'get_profile';

    switch (operation) {
      case 'get_profile':
        return await getUserProfile(supabase, user.id);
      case 'update_profile':
        return await updateUserProfile(supabase, user.id, requestData);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

  } catch (error) {
    console.error('Error in get-user-profile function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// SECURITY: Get user's own profile only (user_id from JWT)
async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: `Failed to fetch profile: ${error.message}` 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      profile: profile,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// SECURITY: Update user's own profile only (user_id from JWT)
async function updateUserProfile(supabase: SupabaseClient, userId: string, requestData: any) {
  const { full_name, phone, wallet_address } = requestData;

  // Only allow updating specific safe fields
  const updateData: any = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (phone !== undefined) updateData.phone = phone;
  if (wallet_address !== undefined) updateData.wallet_address = wallet_address;
  updateData.updated_at = new Date().toISOString();

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: `Failed to update profile: ${error.message}` 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      profile: updatedProfile,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}