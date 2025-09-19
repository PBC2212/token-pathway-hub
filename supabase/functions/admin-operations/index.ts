import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface AdminOperationRequest {
  operation: 'approve_pledge' | 'reject_pledge' | 'update_pledge_status' | 'get_all_pledges' | 'get_blockchain_transactions';
  pledgeId?: string;
  adminNotes?: string;
  tokenAmount?: number;
  rejectionReason?: string;
  newStatus?: string;
  limit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
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
      case 'approve_pledge':
        result = await approvePledge(supabase, requestData, user.id);
        break;
      case 'reject_pledge':
        result = await rejectPledge(supabase, requestData, user.id);
        break;
      case 'update_pledge_status':
        result = await updatePledgeStatus(supabase, requestData, user.id);
        break;
      case 'get_all_pledges':
        result = await getAllPledges(supabase, requestData.limit);
        break;
      case 'get_blockchain_transactions':
        result = await getBlockchainTransactions(supabase);
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

async function approvePledge(supabase: any, requestData: AdminOperationRequest, adminUserId: string) {
  const { pledgeId, tokenAmount, adminNotes } = requestData;
  
  if (!tokenAmount || tokenAmount <= 0) {
    throw new Error('Token amount is required and must be greater than 0');
  }

  // Get the current pledge
  const { data: pledge, error: fetchError } = await supabase
    .from('pledges')
    .select('*')
    .eq('id', pledgeId)
    .single();

  if (fetchError || !pledge) {
    throw new Error('Pledge not found');
  }

  if (pledge.status !== 'pending') {
    throw new Error('Only pending pledges can be approved');
  }

  // Update pledge status to approved
  const { data: updatedPledge, error: updateError } = await supabase
    .from('pledges')
    .update({
      status: 'approved',
      token_amount: tokenAmount,
      approved_at: new Date().toISOString(),
      approved_by: adminUserId,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', pledgeId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to approve pledge: ${updateError.message}`);
  }

  // Create audit log
  await createAuditLog(supabase, {
    pledge_id: pledgeId,
    admin_user_id: adminUserId,
    action: 'approved',
    details: {
      token_amount: tokenAmount,
      admin_notes: adminNotes
    }
  });

  return {
    pledge: updatedPledge,
    message: 'Pledge approved successfully'
  };
}

async function rejectPledge(supabase: any, requestData: AdminOperationRequest, adminUserId: string) {
  const { pledgeId, rejectionReason, adminNotes } = requestData;

  // Get the current pledge
  const { data: pledge, error: fetchError } = await supabase
    .from('pledges')
    .select('*')
    .eq('id', pledgeId)
    .single();

  if (fetchError || !pledge) {
    throw new Error('Pledge not found');
  }

  if (pledge.status !== 'pending') {
    throw new Error('Only pending pledges can be rejected');
  }

  // Update pledge status to rejected
  const { data: updatedPledge, error: updateError } = await supabase
    .from('pledges')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason,
      admin_notes: adminNotes,
      approved_by: adminUserId,
      updated_at: new Date().toISOString()
    })
    .eq('id', pledgeId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to reject pledge: ${updateError.message}`);
  }

  // Create audit log
  await createAuditLog(supabase, {
    pledge_id: pledgeId,
    admin_user_id: adminUserId,
    action: 'rejected',
    details: {
      rejection_reason: rejectionReason,
      admin_notes: adminNotes
    }
  });

  return {
    pledge: updatedPledge,
    message: 'Pledge rejected successfully'
  };
}

async function updatePledgeStatus(supabase: any, requestData: AdminOperationRequest, adminUserId: string) {
  const { pledgeId, newStatus, adminNotes } = requestData;

  if (!newStatus) {
    throw new Error('New status is required');
  }

  const validStatuses = ['pending', 'approved', 'rejected', 'tokens_minted', 'redeemed'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Update pledge status
  const { data: updatedPledge, error: updateError } = await supabase
    .from('pledges')
    .update({
      status: newStatus,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', pledgeId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update pledge status: ${updateError.message}`);
  }

  // Create audit log
  await createAuditLog(supabase, {
    pledge_id: pledgeId,
    admin_user_id: adminUserId,
    action: 'status_updated',
    details: {
      new_status: newStatus,
      admin_notes: adminNotes
    }
  });

  return {
    pledge: updatedPledge,
    message: 'Pledge status updated successfully'
  };
}

async function createAuditLog(supabase: any, logData: {
  pledge_id: string;
  admin_user_id: string;
  action: string;
  details: any;
}) {
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      table_name: 'pledges',
      record_id: logData.pledge_id,
      action: logData.action,
      old_values: null,
      new_values: logData.details,
      user_id: logData.admin_user_id,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to create audit log:', error);
  }
}

// SECURITY: Admin-only function to get all pledges with pagination
async function getAllPledges(supabase: any, limit: number = 50) {
  // Enforce maximum limit for security and performance
  const safeLimit = Math.min(limit, 100);
  
  const { data: pledges, error } = await supabase
    .from('pledges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to fetch pledges: ${error.message}`);
  }

  return {
    pledges: pledges || [],
    total: pledges?.length || 0,
    limit: safeLimit
  };
}

// SECURITY: Admin-only function to get all blockchain transactions  
async function getBlockchainTransactions(supabase: any) {
  const { data: transactions, error } = await supabase
    .from('blockchain_transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return {
    transactions: transactions || [],
    total: transactions?.length || 0
  };
}