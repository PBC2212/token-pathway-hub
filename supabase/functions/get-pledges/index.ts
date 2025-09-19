import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Category Token Mapping (aligned with MultiTokenRwaBackedStablecoin.sol)
const CATEGORY_TOKEN_MAPPING: Record<string, { name: string; symbol: string; color: string }> = {
  'RealEstate': { name: 'Real Estate USD', symbol: 'RUSD', color: 'blue' },
  'Commodities': { name: 'Commodities USD', symbol: 'CUSD', color: 'yellow' },
  'Bonds': { name: 'Bonds USD', symbol: 'BUSD', color: 'green' },
  'Equipment': { name: 'Equipment USD', symbol: 'EUSD', color: 'purple' },
  'Inventory': { name: 'Inventory USD', symbol: 'IUSD', color: 'orange' },
  'Other': { name: 'Other Assets USD', symbol: 'OUSD', color: 'gray' }
};

// PledgeStatus display mapping
const PLEDGE_STATUS_DISPLAY = {
  'pending': 'Pending Verification',
  'approved': 'Verified & Ready to Mint',
  'minted': 'Tokens Minted',
  'rejected': 'Rejected',
  'cancelled': 'Cancelled',
  'redeemed': 'Redeemed',
  'liquidated': 'Liquidated'
};

interface PledgeData {
  id: string;
  pledge_id?: number;
  user_id: string;
  user_address: string;
  asset_type?: string;
  rwa_identifier?: string;
  rwa_category?: string;
  appraised_value: string | number; // Handle Postgres numeric as string
  token_amount?: string | number;
  ltv_ratio?: string | number;
  token_symbol?: string;
  category_token_symbol?: string;
  status: string;
  is_redeemable?: boolean;
  metadata?: string;
  last_valuation_time?: string;
  verified_by_address?: string;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
  [key: string]: any; // Allow additional fields
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with anon key to respect RLS policies
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

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

    // Parse request body to get any additional parameters (optional)
    let requestData = {};
    try {
      if (req.method === 'POST' && req.body) {
        requestData = await req.json();
      }
    } catch (e) {
      // GET request or no body - that's fine
    }

    // Get pledges with explicit user filtering for security
    // RLS policies provide primary security, this is defense-in-depth
    const { data: pledges, error: pledgeError } = await supabase
      .from('pledges')
      .select('*')
      .eq('user_id', user.id) // Only filter by user_id - correct field
      .order('created_at', { ascending: false });
      
    // SECURITY VALIDATION: Final check all returned data belongs to requesting user
    if (pledges) {
      const invalidPledges = pledges.filter(pledge => pledge.user_id !== user.id);
      if (invalidPledges.length > 0) {
        console.error('SECURITY BREACH DETECTED: Found pledges not belonging to user', {
          userId: user.id,
          invalidCount: invalidPledges.length
        });
        return new Response(
          JSON.stringify({ error: 'Data validation failed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (pledgeError) {
      console.error('Error fetching pledges:', pledgeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch pledges',
          details: pledgeError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize pledges data for consistent handling
    const normalizedPledges: PledgeData[] = (pledges || []).map(pledge => ({
      ...pledge,
      appraised_value: parseFloat(pledge.appraised_value?.toString() || '0') || 0,
      token_amount: parseFloat(pledge.token_amount?.toString() || '0') || 0,
      ltv_ratio: parseInt(pledge.ltv_ratio?.toString() || '8000') || 8000,
      rwa_category: pledge.rwa_category || 'Other',
      category_token_symbol: pledge.category_token_symbol || pledge.token_symbol || 'RWA',
      is_redeemable: pledge.is_redeemable !== false // Default to true
    }));

    // Calculate multi-token summary statistics
    const totalPledges = normalizedPledges.length;
    const totalValue = normalizedPledges.reduce((sum, pledge) => sum + pledge.appraised_value, 0);
    const totalTokens = normalizedPledges.reduce((sum, pledge) => sum + pledge.token_amount, 0);
    
    // Status breakdown
    const statusBreakdown = normalizedPledges.reduce((acc, pledge) => {
      const status = pledge.status;
      if (!acc[status]) {
        acc[status] = {
          count: 0,
          totalValue: 0,
          displayName: PLEDGE_STATUS_DISPLAY[status] || status
        };
      }
      acc[status].count += 1;
      acc[status].totalValue += pledge.appraised_value;
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; displayName: string }>);

    // Multi-token category breakdown (aligned with contract RwaCategory enum)
    const categoryBreakdown = normalizedPledges.reduce((acc, pledge) => {
      const category = pledge.rwa_category || 'Other';
      const tokenInfo = CATEGORY_TOKEN_MAPPING[category];
      
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          totalValue: 0,
          totalTokens: 0,
          tokenSymbol: tokenInfo?.symbol || 'UNKNOWN',
          tokenName: tokenInfo?.name || category,
          color: tokenInfo?.color || 'gray',
          avgLtv: 0,
          redeemableCount: 0
        };
      }
      
      acc[category].count += 1;
      acc[category].totalValue += pledge.appraised_value;
      acc[category].totalTokens += pledge.token_amount;
      acc[category].avgLtv += pledge.ltv_ratio;
      if (pledge.is_redeemable) {
        acc[category].redeemableCount += 1;
      }
      
      return acc;
    }, {} as Record<string, { 
      count: number; 
      totalValue: number; 
      totalTokens: number; 
      tokenSymbol: string;
      tokenName: string;
      color: string;
      avgLtv: number;
      redeemableCount: number;
    }>);

    // Calculate average LTV for each category
    Object.keys(categoryBreakdown).forEach(category => {
      if (categoryBreakdown[category].count > 0) {
        categoryBreakdown[category].avgLtv = 
          Math.round(categoryBreakdown[category].avgLtv / categoryBreakdown[category].count);
      }
    });

    // Legacy asset type breakdown (for backwards compatibility)
    const assetTypeBreakdown = normalizedPledges.reduce((acc, pledge) => {
      const assetType = pledge.asset_type || 'other';
      if (!acc[assetType]) {
        acc[assetType] = {
          count: 0,
          totalValue: 0,
          totalTokens: 0
        };
      }
      acc[assetType].count += 1;
      acc[assetType].totalValue += pledge.appraised_value;
      acc[assetType].totalTokens += pledge.token_amount;
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; totalTokens: number }>);

    const response = {
      userId: user.id,
      userEmail: user.email,
      pledges: normalizedPledges,
      summary: {
        totalPledges,
        totalValue,
        totalTokens,
        // Multi-token specific analytics
        statusBreakdown,
        categoryBreakdown,
        // Legacy compatibility
        assetTypeBreakdown,
        // Additional insights
        insights: {
          avgPledgeValue: totalPledges > 0 ? totalValue / totalPledges : 0,
          avgTokenAmount: totalPledges > 0 ? totalTokens / totalPledges : 0,
          categoriesActive: Object.keys(categoryBreakdown).length,
          redeemablePledges: normalizedPledges.filter(p => p.is_redeemable).length,
          mintablePledges: normalizedPledges.filter(p => p.status === 'approved' && !p.token_minted).length,
          topCategory: Object.entries(categoryBreakdown).sort(([,a], [,b]) => b.totalValue - a.totalValue)[0]?.[0] || 'None'
        }
      },
      // Contract alignment metadata
      contractInfo: {
        multiTokenEnabled: true,
        supportedCategories: Object.keys(CATEGORY_TOKEN_MAPPING),
        tokenMappings: CATEGORY_TOKEN_MAPPING
      },
      lastUpdated: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-pledges function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});