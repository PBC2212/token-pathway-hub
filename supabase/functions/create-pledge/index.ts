import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PledgeRequest {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const pledgeData: PledgeRequest = await req.json()

    if (!pledgeData.user_address || !pledgeData.asset_type || !pledgeData.appraised_value) {
      throw new Error('Missing required fields')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization required')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    const pledgeId = Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000)

    const pledgeRecord = {
      user_id: user.id,
      user_address: pledgeData.user_address,
      asset_type: pledgeData.asset_type,
      appraised_value: pledgeData.appraised_value,
      token_amount: 0,
      token_symbol: pledgeData.token_symbol || `${pledgeData.asset_type.toUpperCase()}${pledgeId}`,
      contract_address: pledgeData.contract_address || '',
      description: pledgeData.description,
      document_hash: pledgeData.document_hash || '',
      appraisal_date: pledgeData.appraisal_date || new Date().toISOString().split('T')[0],
      appraiser_license: pledgeData.appraiser_license,
      status: 'pending'
    }

    const { data: dbPledge, error: dbError } = await supabase
      .from('pledges')
      .insert(pledgeRecord)
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error(`Failed to create pledge record: ${dbError.message}`)
    }

    // For now, we just create the database record
    // Blockchain integration can be added later

    const response = {
      success: true,
      message: 'Pledge created successfully',
      pledgeId: pledgeId,
      data: dbPledge
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in create-pledge:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})