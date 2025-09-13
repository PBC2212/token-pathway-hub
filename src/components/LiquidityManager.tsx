import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Droplets, Plus, Minus, TrendingUp, DollarSign, Activity } from 'lucide-react';

interface Pool {
  id: string;
  token_a: string;
  token_b: string;
  pool_type: string;
  fee_rate: string;
  status: string;
  initial_liquidity_a: string;
  initial_liquidity_b: string;
  created_at: string;
  stats: {
    totalLiquidity: number;
    totalOperations: number;
    lastActivity: string;
  };
  prices: {
    tokenA: number;
    tokenB: number;
  };
  tvl: number;
}

const LiquidityManager = () => {
  const { toast } = useToast();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pools');
  
  // Create pool form state
  const [createForm, setCreateForm] = useState({
    tokenA: '',
    tokenB: 'USDC',
    initialLiquidityA: '',
    initialLiquidityB: '',
    poolType: 'uniswap_v3',
    feeRate: '0.3'
  });

  // Add/Remove liquidity form state
  const [liquidityForm, setLiquidityForm] = useState({
    poolId: '',
    tokenAAmount: '',
    tokenBAmount: '',
    slippageTolerance: '2.0'
  });

  const fetchPools = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('liquidity-get-pools', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (response.error) throw response.error;
      
      setPools(response.data.pools || []);
    } catch (error: any) {
      console.error('Error fetching pools:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch liquidity pools',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, []);

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.tokenA || !createForm.initialLiquidityA || !createForm.initialLiquidityB) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('liquidity-create-pool', {
        body: createForm,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Success',
        description: 'Liquidity pool creation initiated'
      });

      // Reset form
      setCreateForm({
        tokenA: '',
        tokenB: 'USDC',
        initialLiquidityA: '',
        initialLiquidityB: '',
        poolType: 'uniswap_v3',
        feeRate: '0.3'
      });

      // Refresh pools
      fetchPools();
    } catch (error: any) {
      console.error('Error creating pool:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create liquidity pool',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidityOperation = async (action: 'add' | 'remove') => {
    if (!liquidityForm.poolId || !liquidityForm.tokenAAmount || !liquidityForm.tokenBAmount) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('liquidity-add-remove', {
        body: {
          ...liquidityForm,
          action
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Success',
        description: `Liquidity ${action} operation initiated`
      });

      // Reset form
      setLiquidityForm({
        poolId: '',
        tokenAAmount: '',
        tokenBAmount: '',
        slippageTolerance: '2.0'
      });

      // Refresh pools
      fetchPools();
    } catch (error: any) {
      console.error(`Error ${action}ing liquidity:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} liquidity`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Liquidity Manager</h1>
          <p className="text-muted-foreground">
            Create and manage liquidity pools for your RWA tokens
          </p>
        </div>
        <Droplets className="h-12 w-12 text-primary" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pools">My Pools</TabsTrigger>
          <TabsTrigger value="create">Create Pool</TabsTrigger>
          <TabsTrigger value="manage">Manage Liquidity</TabsTrigger>
        </TabsList>

        <TabsContent value="pools" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <Card key={pool.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {pool.token_a}/{pool.token_b}
                    </CardTitle>
                    <Badge variant={pool.status === 'active' ? 'default' : 'secondary'}>
                      {pool.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pool.pool_type} • {pool.fee_rate}% fee
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      TVL
                    </span>
                    <span className="font-semibold">{formatCurrency(pool.tvl)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Total Liquidity
                    </span>
                    <span>{pool.stats.totalLiquidity.toFixed(4)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Operations
                    </span>
                    <span>{pool.stats.totalOperations}</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{pool.token_a}</p>
                      <p className="font-semibold">{pool.initial_liquidity_a}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{pool.token_b}</p>
                      <p className="font-semibold">{pool.initial_liquidity_b}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {pools.length === 0 && !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Liquidity Pools</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first liquidity pool to start earning fees from trading
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Pool
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Liquidity Pool</CardTitle>
              <p className="text-muted-foreground">
                Set up a new liquidity pool for your RWA tokens
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePool} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenA">Token A</Label>
                    <Input
                      id="tokenA"
                      placeholder="e.g., RWA-REAL-ESTATE"
                      value={createForm.tokenA}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, tokenA: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenB">Token B</Label>
                    <Select
                      value={createForm.tokenB}
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, tokenB: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="liquidityA">Initial Liquidity A</Label>
                    <Input
                      id="liquidityA"
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={createForm.initialLiquidityA}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, initialLiquidityA: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="liquidityB">Initial Liquidity B</Label>
                    <Input
                      id="liquidityB"
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={createForm.initialLiquidityB}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, initialLiquidityB: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="poolType">Pool Type</Label>
                    <Select
                      value={createForm.poolType}
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, poolType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uniswap_v3">Uniswap V3</SelectItem>
                        <SelectItem value="curve">Curve Finance</SelectItem>
                        <SelectItem value="balancer">Balancer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feeRate">Fee Rate (%)</Label>
                    <Select
                      value={createForm.feeRate}
                      onValueChange={(value) => setCreateForm(prev => ({ ...prev, feeRate: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.05">0.05%</SelectItem>
                        <SelectItem value="0.3">0.3%</SelectItem>
                        <SelectItem value="1.0">1.0%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating Pool...' : 'Create Liquidity Pool'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add/Remove Liquidity</CardTitle>
              <p className="text-muted-foreground">
                Manage your liquidity positions
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="poolSelect">Select Pool</Label>
                  <Select
                    value={liquidityForm.poolId}
                    onValueChange={(value) => setLiquidityForm(prev => ({ ...prev, poolId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a pool" />
                    </SelectTrigger>
                    <SelectContent>
                      {pools.map((pool) => (
                        <SelectItem key={pool.id} value={pool.id}>
                          {pool.token_a}/{pool.token_b} ({pool.pool_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tokenAAmount">Token A Amount</Label>
                    <Input
                      id="tokenAAmount"
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={liquidityForm.tokenAAmount}
                      onChange={(e) => setLiquidityForm(prev => ({ ...prev, tokenAAmount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenBAmount">Token B Amount</Label>
                    <Input
                      id="tokenBAmount"
                      type="number"
                      step="0.0001"
                      placeholder="0.0000"
                      value={liquidityForm.tokenBAmount}
                      onChange={(e) => setLiquidityForm(prev => ({ ...prev, tokenBAmount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
                  <Input
                    id="slippage"
                    type="number"
                    step="0.1"
                    placeholder="2.0"
                    value={liquidityForm.slippageTolerance}
                    onChange={(e) => setLiquidityForm(prev => ({ ...prev, slippageTolerance: e.target.value }))}
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1"
                    onClick={() => handleLiquidityOperation('add')}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Liquidity
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleLiquidityOperation('remove')}
                    disabled={loading}
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Remove Liquidity
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LiquidityManager;