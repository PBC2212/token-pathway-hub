import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminOperationRequest {
  operation: 'get_pledges' | 'update_pledge' | 'get_audit_logs' | 'get_summary';
  pledgeId?: string;
  status?: string;
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

      case 'update_pledge':
        if (!requestData.pledgeId || !requestData.status) {
          throw new Error('Pledge ID and status are required');
        }

        // Use the secure update function
        const { data: updateData, error: updateError } = await supabase
          .rpc('admin_update_pledge_status', {
            p_pledge_id: requestData.pledgeId,
            p_new_status: requestData.status,
            p_admin_notes: requestData.adminNotes
          });

        if (updateError) {
          throw new Error(`Failed to update pledge: ${updateError.message}`);
        }

-- Add indexes for better performance (skip constraint as it exists)
CREATE INDEX IF NOT EXISTS idx_pledges_status ON public.pledges(status);
CREATE INDEX IF NOT EXISTS idx_pledges_user_status ON public.pledges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pledges_created_at ON public.pledges(created_at DESC);

-- Create function to notify status changes
CREATE OR REPLACE FUNCTION public.notify_pledge_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify on pledge status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'pledge_status_changed',
      json_build_object(
        'pledge_id', NEW.id,
        'user_id', NEW.user_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_at', NEW.updated_at
      )::text
    );
  END IF;
  
  -- Notify on new pledges
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_notify(
      'pledge_created',
      json_build_object(
        'pledge_id', NEW.id,
        'user_id', NEW.user_id,
        'status', NEW.status,
        'asset_type', NEW.asset_type,
        'appraised_value', NEW.appraised_value
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for real-time notifications
DROP TRIGGER IF EXISTS trigger_pledge_status_change ON public.pledges;
CREATE TRIGGER trigger_pledge_status_change
  AFTER INSERT OR UPDATE ON public.pledges
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pledge_status_change();

-- Enable realtime for pledges table
ALTER TABLE public.pledges REPLICA IDENTITY FULL;

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