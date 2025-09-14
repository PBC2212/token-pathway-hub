import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApprovalRequest {
  pledgeId: string;
  action: 'approve' | 'reject';
  tokenAmount?: number;
  adminNotes?: string;
  rejectionReason?: string;
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

    const approvalData: ApprovalRequest = await req.json()

    if (!approvalData.pledgeId || !approvalData.action) {
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    const updateData: any = {
      status: approvalData.action === 'approve' ? 'approved' : 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      admin_notes: approvalData.adminNotes
    }

    if (approvalData.action === 'approve' && approvalData.tokenAmount) {
      updateData.token_amount = approvalData.tokenAmount
    }

    if (approvalData.action === 'reject' && approvalData.rejectionReason) {
      updateData.rejection_reason = approvalData.rejectionReason
    }

    const { data: updatedPledge, error: updateError } = await supabase
      .from('pledges')
      .update(updateData)
      .eq('id', approvalData.pledgeId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error(`Failed to update pledge: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Pledge ${approvalData.action}d successfully`,
        data: updatedPledge
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in approve-pledge:', error)
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