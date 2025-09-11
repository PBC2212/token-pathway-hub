import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const payload = await req.json()
    console.log('Cognito webhook received:', payload)

    const userId = payload.Entry?.UserId
    const agreementTypeId = payload.Entry?.AgreementTypeId
    const cognitoEntryId = payload.Entry?.Number

    if (!userId || !agreementTypeId) {
      throw new Error('Missing required fields: userId or agreementTypeId')
    }

    const { data, error } = await supabase
      .from('user_agreements')
      .upsert({
        user_id: userId,
        agreement_type_id: agreementTypeId,
        status: 'completed',
        submitted_at: new Date().toISOString(),
        cognito_submission_id: cognitoEntryId
      }, {
        onConflict: 'user_id,agreement_type_id'
      })

    if (error) throw error

    // Also store the submission data
    await supabase
      .from('cognito_submissions')
      .insert({
        user_agreement_id: data?.[0]?.id,
        cognito_entry_id: cognitoEntryId,
        cognito_form_id: payload.Form?.Id,
        submission_data: payload
      })

    return new Response(
      JSON.stringify({ success: true, message: 'Agreement status updated' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})