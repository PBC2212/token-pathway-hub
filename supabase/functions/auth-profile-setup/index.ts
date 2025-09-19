import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAILS = new Set(['info@imecapitaltokenization.com','admin@tokenization.com']);

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

    // SECURITY: Only allow users to manage their own profile
    await ensureUserProfile(supabase, user);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profile setup completed',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in auth-profile-setup function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// SECURITY: Ensure user's own profile exists and set admin role for admin emails only
async function ensureUserProfile(supabase: SupabaseClient, user: any) {
  try {
    // Check if profile already exists for this user only
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create profile if it doesn't exist
    if (!existing) {
      await supabase.from('profiles').insert({
        user_id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.email,
        created_at: new Date().toISOString()
      });
    }

    // Set admin role for known admin emails only
    const email = user.email?.toLowerCase();
    if (email && ADMIN_EMAILS.has(email)) {
      await supabase
        .from('profiles')
        .update({ 
          role: 'admin', 
          kyc_status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    }
  } catch (error) {
    console.error('Profile setup error:', error);
    throw error;
  }
}