import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Get pools request received');
    
    // Get authorization header first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Use anon key to respect RLS policies for user data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const url = new URL(req.url);
    const poolId = url.searchParams.get('poolId');
    const adminView = url.searchParams.get('adminView') === 'true';
    
    // CRITICAL: Default to user-only view for security
    let query = supabase.from('liquidity_pools').select(`
      *,
      liquidity_operations (
        id,
        operation_type,
        token_a_amount,
        token_b_amount,
        status,
        created_at
      )
    `);

    // ALWAYS filter by user_id unless admin is explicitly requesting admin view
    if (!adminView) {
      query = query.eq('user_id', user.id);
    } else {
      // TODO: Add admin role verification here for admin view
      console.warn('Admin view requested but admin verification not implemented');
      query = query.eq('user_id', user.id); // Default to user view for now
    }

    if (poolId) {
      query = query.eq('id', poolId);
      // For specific pool ID, still ensure user ownership
      query = query.eq('user_id', user.id);
    }

    query = query.order('created_at', { ascending: false });

    const { data: pools, error: poolsError } = await query;

    if (poolsError) {
      console.error('Database error:', poolsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch pools' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Calculate pool statistics
    const poolsWithStats = pools?.map(pool => {
      const operations = pool.liquidity_operations || [];
      const addOperations = operations.filter((op: any) => op.operation_type === 'add');
      const removeOperations = operations.filter((op: any) => op.operation_type === 'remove');
      
      const totalAdded = addOperations.reduce((sum: number, op: any) => 
        sum + parseFloat(op.token_a_amount || '0'), 0);
      const totalRemoved = removeOperations.reduce((sum: number, op: any) => 
        sum + parseFloat(op.token_a_amount || '0'), 0);
      
      return {
        ...pool,
        stats: {
          totalLiquidity: totalAdded - totalRemoved,
          totalOperations: operations.length,
          lastActivity: operations[0]?.created_at || pool.created_at
        }
      };
    }) || [];

    // Mock price data (in a real implementation, this would come from price oracles)
    const mockPrices = {
      'USDC': 1.00,
      'USDT': 1.00,
      'ETH': 2500.00,
      'BTC': 45000.00
    };

    const poolsWithPrices = poolsWithStats.map(pool => ({
      ...pool,
      prices: {
        tokenA: mockPrices[pool.token_a as keyof typeof mockPrices] || 1.00,
        tokenB: mockPrices[pool.token_b as keyof typeof mockPrices] || 1.00
      },
      tvl: (parseFloat(pool.initial_liquidity_a || '0') * (mockPrices[pool.token_a as keyof typeof mockPrices] || 1)) +
            (parseFloat(pool.initial_liquidity_b || '0') * (mockPrices[pool.token_b as keyof typeof mockPrices] || 1))
    }));

    return new Response(JSON.stringify({ 
      success: true,
      pools: poolsWithPrices,
      totalPools: poolsWithPrices.length
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('Error in liquidity-get-pools:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal Server Error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});