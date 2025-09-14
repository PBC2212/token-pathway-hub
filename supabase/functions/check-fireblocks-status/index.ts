import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Consider Fireblocks "connected" if the required secrets exist
    const hasApiKey = !!Deno.env.get('FIREBLOCKS_API_KEY')
    const hasPrivateKey = !!Deno.env.get('FIREBLOCKS_PRIVATE_KEY')
    const hasBaseUrl = !!Deno.env.get('FIREBLOCKS_BASE_URL')

    const connected = hasApiKey && hasPrivateKey && hasBaseUrl

    const response = {
      connected,
      mode: connected ? 'custody' : 'database',
      message: connected ? 'Fireblocks custody enabled' : 'Running without Fireblocks (database-only mode)'
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('check-fireblocks-status error:', error)
    return new Response(JSON.stringify({ connected: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})