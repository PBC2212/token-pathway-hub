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

    const payload = await req.json();
    console.log('Cognito webhook received payload keys:', Object.keys(payload));

    const entry = payload.Entry ?? payload.entry ?? payload.data ?? payload;
    const userId = entry?.UserId ?? entry?.userId ?? entry?.user_id ?? payload?.UserId ?? payload?.userId ?? payload?.user_id;
    const agreementTypeId = entry?.AgreementTypeId ?? entry?.agreement_type_id ?? payload?.AgreementTypeId ?? payload?.agreement_type_id;
    const cognitoEntryId = entry?.Number ?? entry?.EntryId ?? entry?.id ?? payload?.EntryId ?? payload?.id;

    if (!userId || !agreementTypeId) {
      console.error('Missing fields after parse', { userId, agreementTypeId, entryKeys: entry ? Object.keys(entry) : [] });
      throw new Error('Missing required fields: userId or agreementTypeId');
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('user_agreements')
      .upsert(
        {
          user_id: userId,
          agreement_type_id: agreementTypeId,
          status: 'completed',
          submitted_at: new Date().toISOString(),
          cognito_submission_id: cognitoEntryId,
        },
        { onConflict: 'user_id,agreement_type_id' }
      )
      .select();

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      throw upsertError
    }

    const userAgreementId = upserted?.[0]?.id

    // Also store the submission data
    const { error: submissionError } = await supabase
      .from('cognito_submissions')
      .insert({
        user_agreement_id: userAgreementId ?? null,
        cognito_entry_id: String(cognitoEntryId ?? ''),
        cognito_form_id: String(payload.Form?.Id ?? payload.form?.id ?? ''),
        submission_data: payload
      })

    if (submissionError) {
      console.error('Submission insert error:', submissionError)
    }

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