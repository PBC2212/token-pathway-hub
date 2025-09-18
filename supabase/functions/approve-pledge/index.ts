import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Category Token Mapping (aligned with MultiTokenRwaBackedStablecoin.sol)
const CATEGORY_TOKEN_MAPPING: Record<string, { name: string; symbol: string }> = {
  'RealEstate': { name: 'Real Estate USD', symbol: 'RUSD' },
  'Commodities': { name: 'Commodities USD', symbol: 'CUSD' },
  'Bonds': { name: 'Bonds USD', symbol: 'BUSD' },
  'Equipment': { name: 'Equipment USD', symbol: 'EUSD' },
  'Inventory': { name: 'Inventory USD', symbol: 'IUSD' },
  'Other': { name: 'Other Assets USD', symbol: 'OUSD' }
};

// PledgeStatus mapping aligned with MultiTokenRwaBackedStablecoin.sol
// Using database-consistent status values to avoid breaking existing flows
const PLEDGE_STATUS_MAPPING = {
  pending: 'pending',       // PledgeStatus.Pending
  verified: 'approved',     // PledgeStatus.Verified (keep 'approved' for DB consistency)
  minted: 'minted',         // PledgeStatus.Minted  
  rejected: 'rejected',     // PledgeStatus.Rejected
  cancelled: 'cancelled',   // PledgeStatus.Cancelled
  redeemed: 'redeemed',     // PledgeStatus.Redeemed
  liquidated: 'liquidated'  // PledgeStatus.Liquidated
};

// Category normalization function (matches create-pledge)
function normalizeRwaCategory(category: string): string {
  if (!category) return 'Other';
  
  const normalizedInput = category.trim().toLowerCase().replace(/_/g, '');
  const categoryMap: Record<string, string> = {
    'realestate': 'RealEstate',
    'commodities': 'Commodities',
    'bonds': 'Bonds',
    'equipment': 'Equipment',
    'inventory': 'Inventory',
    'other': 'Other'
  };
  return categoryMap[normalizedInput] || category; // Keep original if no match
}

interface ApprovalRequest {
  pledgeId: string;
  action: 'approve' | 'reject';
  tokenAmount?: number; // Optional - will be calculated from LTV if not provided
  adminNotes?: string;
  rejectionReason?: string;
  // Multi-token fields
  adjustedAppraisedValue?: number; // Allow admin to adjust appraised value
  customLtvRatio?: number; // Allow admin to set custom LTV ratio
  verifierAddress?: string; // Address of the verifier in contract
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

    // Fetch the pledge to get current details for multi-token calculations
    const { data: pledge, error: pledgeError } = await supabase
      .from('pledges')
      .select('*')
      .eq('id', approvalData.pledgeId)
      .single();

    if (pledgeError || !pledge) {
      throw new Error(`Pledge not found: ${pledgeError?.message || 'Unknown error'}`)
    }

    // Validate pledge status - must be pending to approve/reject
    if (pledge.status !== 'pending') {
      throw new Error(`Cannot ${approvalData.action} pledge with status: ${pledge.status}`)
    }

    const updateData: any = {
      status: approvalData.action === 'approve' ? PLEDGE_STATUS_MAPPING.verified : PLEDGE_STATUS_MAPPING.rejected,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      admin_notes: approvalData.adminNotes
    }

    // Only set verified_by_address if a valid EVM address is provided
    if (approvalData.verifierAddress) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(approvalData.verifierAddress)) {
        throw new Error('verified_by_address must be a valid Ethereum address (0x format)')
      }
      updateData.verified_by_address = approvalData.verifierAddress;
    }
    // Note: approved_by remains as user.id (UUID) for internal tracking

    if (approvalData.action === 'approve') {
      // Multi-token approval logic with proper normalization
      const normalizedRwaCategory = normalizeRwaCategory(pledge.rwa_category || 'Other');
      const categoryTokenInfo = CATEGORY_TOKEN_MAPPING[normalizedRwaCategory];
      
      if (!categoryTokenInfo) {
        throw new Error(`Invalid RWA category: ${normalizedRwaCategory}. Valid categories: ${Object.keys(CATEGORY_TOKEN_MAPPING).join(', ')}`)
      }

      // Calculate token amount based on LTV ratio
      const appraisedValue = approvalData.adjustedAppraisedValue || parseFloat(pledge.appraised_value?.toString() || '0');
      const ltvRatio = approvalData.customLtvRatio || parseInt(pledge.ltv_ratio?.toString() || '8000'); // Default 80%
      
      // Validate adjusted values (aligned with contract requirements)
      if (appraisedValue < 1000 || appraisedValue > 100_000_000) {
        throw new Error('Appraised value must be between $1,000 and $100,000,000')
      }
      
      // Contract-aligned LTV validation: 10%-100% (1000-10000 basis points)
      if (ltvRatio < 1000 || ltvRatio > 10000) {
        throw new Error('LTV ratio must be between 1000 and 10000 basis points (10% - 100%)')
      }

      // Calculate maximum allowed token amount based on LTV
      const maxAllowedTokenAmount = appraisedValue * (ltvRatio / 10000);
      
      // Validate provided token amount doesn't exceed LTV cap
      let finalTokenAmount: number;
      if (approvalData.tokenAmount) {
        if (approvalData.tokenAmount > maxAllowedTokenAmount) {
          throw new Error(`Token amount (${approvalData.tokenAmount}) exceeds maximum allowed by LTV: ${maxAllowedTokenAmount.toFixed(2)}`)
        }
        finalTokenAmount = approvalData.tokenAmount;
      } else {
        finalTokenAmount = maxAllowedTokenAmount;
      }
      
      // Update with multi-token fields
      updateData.token_amount = finalTokenAmount;
      updateData.category_token_symbol = categoryTokenInfo.symbol;
      updateData.rwa_category = normalizedRwaCategory; // Store normalized category
      updateData.appraised_value = appraisedValue; // Store adjusted value if provided
      updateData.ltv_ratio = ltvRatio; // Store custom LTV if provided
      updateData.last_valuation_time = new Date().toISOString();
      
      console.log(`Approved pledge ${approvalData.pledgeId}:`, {
        category: normalizedRwaCategory,
        tokenSymbol: categoryTokenInfo.symbol,
        appraisedValue,
        ltvRatio: `${ltvRatio / 100}%`,
        maxAllowed: maxAllowedTokenAmount,
        finalTokenAmount
      });
      
    } else if (approvalData.action === 'reject' && approvalData.rejectionReason) {
      updateData.rejection_reason = approvalData.rejectionReason;
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