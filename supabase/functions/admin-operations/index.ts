import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminOperationRequest {
  operation: 'get_pledges' | 'approve_pledge' | 'reject_pledge' | 'get_audit_logs' | 'get_summary';
  pledgeId?: string;
  tokenAmount?: number;
  rejectionReason?: string;
  adminNotes?: string;
  maskFinancialData?: boolean;
  limit?: number;
  offset?: number;
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: AdminOperationRequest = await req.json();

    let result;
    switch (requestData.operation) {
      case 'get_pledges':
        // Use the secure admin view function
        const { data: pledgesData, error: pledgesError } = await supabase
          .rpc('get_pledges_admin_view', {
            p_mask_financial_data: requestData.maskFinancialData ?? true,
            p_limit: requestData.limit ?? 50
          });

        if (pledgesError) {
          throw new Error(`Failed to fetch pledges: ${pledgesError.message}`);
        }

        result = {
          pledges: pledgesData,
          total: pledgesData?.length || 0
        };
        break;

      case 'approve_pledge':
        if (!requestData.pledgeId || !requestData.tokenAmount) {
          throw new Error('Pledge ID and token amount are required');
        }

        // Use the secure update function
        const { data: approveData, error: approveError } = await supabase
          .rpc('admin_update_pledge_secure', {
            p_pledge_id: requestData.pledgeId,
            p_new_status: 'approved',
            p_admin_notes: requestData.adminNotes || `Approved with ${requestData.tokenAmount} tokens`
          });

        if (approveError) {
          throw new Error(`Failed to approve pledge: ${approveError.message}`);
        }

        // Update token amount in pledge record
        const { error: tokenUpdateError } = await supabase
          .from('pledges')
          .update({ 
            token_amount: requestData.tokenAmount,
            approved_at: new Date().toISOString(),
            approved_by: user.id
          })
          .eq('id', requestData.pledgeId);

        if (tokenUpdateError) {
          console.warn('Failed to update token amount:', tokenUpdateError);
        }

        result = { success: true, approved: true, tokenAmount: requestData.tokenAmount };
        break;

      case 'reject_pledge':
        if (!requestData.pledgeId || !requestData.rejectionReason) {
          throw new Error('Pledge ID and rejection reason are required');
        }

        // Use the secure update function
        const { data: rejectData, error: rejectError } = await supabase
          .rpc('admin_update_pledge_secure', {
            p_pledge_id: requestData.pledgeId,
            p_new_status: 'rejected',
            p_admin_notes: `Rejected: ${requestData.rejectionReason}`
          });

        if (rejectError) {
          throw new Error(`Failed to reject pledge: ${rejectError.message}`);
        }

        // Update rejection reason
        const { error: rejectUpdateError } = await supabase
          .from('pledges')
          .update({ rejection_reason: requestData.rejectionReason })
          .eq('id', requestData.pledgeId);

        if (rejectUpdateError) {
          console.warn('Failed to update rejection reason:', rejectUpdateError);
        }

        result = { success: true, rejected: true, reason: requestData.rejectionReason };
        break;

      case 'get_audit_logs':
        // Get audit logs with RLS automatically applied
        const { data: auditData, error: auditError } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(requestData.limit ?? 100)
          .range(requestData.offset ?? 0, (requestData.offset ?? 0) + (requestData.limit ?? 100) - 1);

        if (auditError) {
          throw new Error(`Failed to fetch audit logs: ${auditError.message}`);
        }

        result = {
          auditLogs: auditData,
          total: auditData?.length || 0
        };
        break;

      case 'get_summary':
        // Use the secure summary function
        const { data: summaryData, error: summaryError } = await supabase
          .rpc('get_pledges_summary');

        if (summaryError) {
          throw new Error(`Failed to fetch summary: ${summaryError.message}`);
        }

        result = {
          summary: summaryData
        };
        break;

      default:
        throw new Error(`Unknown operation: ${requestData.operation}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in admin-operations function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});