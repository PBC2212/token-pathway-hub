import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Droplets, Plus, Calculator, Info } from 'lucide-react';

interface TokenOption {
  symbol: string;
  balance: number;
  name: string;
  type: 'minted' | 'stable' | 'native';
}

const PoolCreator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<TokenOption[]>([]);
  
  const [poolForm, setPoolForm] = useState({
    tokenA: '',
    tokenB: 'USDC',
    amountA: '',
    amountB: '',
    poolType: 'uniswap_v3',
    feeRate: '0.3',
    priceRange: {
      min: '',
      max: ''
    }
  });

  const [calculatedValues, setCalculatedValues] = useState({
    estimatedLPTokens: 0,
    initialPrice: 0,
    minimumReceive: 0
  });

  const fetchAvailableTokens = async () => {
    if (!user) return;

    try {
      // Fetch user's token balances
      const { data: balances, error } = await supabase
        .from('token_balances')
        .select('*')
        .eq('user_address', user.id);

      if (error) {
        console.error('Error fetching token balances:', error);
        return;
      }

      const tokens: TokenOption[] = [
        // User's minted tokens
        ...(balances || []).map(balance => ({
          symbol: balance.token_symbol,
          balance: typeof balance.balance === 'string' ? parseFloat(balance.balance) : balance.balance,
          name: balance.token_symbol,
          type: 'minted' as const
        })),
        // Stable coins
        {
          symbol: 'USDC',
          balance: 10000, // Mock balance
          name: 'USD Coin',
          type: 'stable'
        },
        {
          symbol: 'USDT',
          balance: 5000,
          name: 'Tether USD',
          type: 'stable'
        },
        // Native tokens
        {
          symbol: 'ETH',
          balance: 2.5,
          name: 'Ethereum',
          type: 'native'
        }
      ];

      setAvailableTokens(tokens);
    } catch (error) {
      console.error('Error fetching available tokens:', error);
    }
  };

  const calculatePoolValues = () => {
    const amountA = parseFloat(poolForm.amountA) || 0;
    const amountB = parseFloat(poolForm.amountB) || 0;

    if (amountA > 0 && amountB > 0) {
      const price = amountB / amountA;
      const lpTokens = Math.sqrt(amountA * amountB);
      const minimumReceive = lpTokens * 0.995; // 0.5% slippage

      setCalculatedValues({
        estimatedLPTokens: lpTokens,
        initialPrice: price,
        minimumReceive: minimumReceive
      });
    } else {
      setCalculatedValues({
        estimatedLPTokens: 0,
        initialPrice: 0,
        minimumReceive: 0
      });
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!poolForm.tokenA || !poolForm.amountA || !poolForm.amountB) {
      toast({
        title: 'Missing Information',
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
        body: {
          tokenA: poolForm.tokenA,
          tokenB: poolForm.tokenB,
          initialLiquidityA: poolForm.amountA,
          initialLiquidityB: poolForm.amountB,
          poolType: poolForm.poolType,
          feeRate: poolForm.feeRate
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'Pool Created Successfully!',
        description: `Created ${poolForm.tokenA}/${poolForm.tokenB} liquidity pool`
      });

      // Reset form
      setPoolForm({
        tokenA: '',
        tokenB: 'USDC',
        amountA: '',
        amountB: '',
        poolType: 'uniswap_v3',
        feeRate: '0.3',
        priceRange: { min: '', max: '' }
      });

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

  useEffect(() => {
    if (user) {
      fetchAvailableTokens();
    }
  }, [user]);

  useEffect(() => {
    calculatePoolValues();
  }, [poolForm.amountA, poolForm.amountB]);

  const getTokenBadgeColor = (type: string) => {
    switch (type) {
      case 'minted': return 'bg-primary/10 text-primary';
      case 'stable': return 'bg-green-100 text-green-800';
      case 'native': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Create Liquidity Pool
        </CardTitle>
        <p className="text-muted-foreground">
          Create a new liquidity pool with your tokens to earn trading fees
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreatePool} className="space-y-6">
          {/* Token Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenA">Token A</Label>
              <Select
                value={poolForm.tokenA}
                onValueChange={(value) => setPoolForm(prev => ({ ...prev, tokenA: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.filter(token => token.symbol !== poolForm.tokenB).map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span>{token.symbol}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={getTokenBadgeColor(token.type)}>
                            {token.type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {token.balance.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenB">Token B</Label>
              <Select
                value={poolForm.tokenB}
                onValueChange={(value) => setPoolForm(prev => ({ ...prev, tokenB: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTokens.filter(token => token.symbol !== poolForm.tokenA).map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center justify-between w-full">
                        <span>{token.symbol}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={getTokenBadgeColor(token.type)}>
                            {token.type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {token.balance.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountA">Amount A</Label>
              <Input
                id="amountA"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={poolForm.amountA}
                onChange={(e) => setPoolForm(prev => ({ ...prev, amountA: e.target.value }))}
              />
              {poolForm.tokenA && (
                <p className="text-xs text-muted-foreground">
                  Available: {availableTokens.find(t => t.symbol === poolForm.tokenA)?.balance.toFixed(4) || '0'} {poolForm.tokenA}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountB">Amount B</Label>
              <Input
                id="amountB"
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={poolForm.amountB}
                onChange={(e) => setPoolForm(prev => ({ ...prev, amountB: e.target.value }))}
              />
              {poolForm.tokenB && (
                <p className="text-xs text-muted-foreground">
                  Available: {availableTokens.find(t => t.symbol === poolForm.tokenB)?.balance.toFixed(4) || '0'} {poolForm.tokenB}
                </p>
              )}
            </div>
          </div>

          {/* Pool Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="poolType">Pool Type</Label>
              <Select
                value={poolForm.poolType}
                onValueChange={(value) => setPoolForm(prev => ({ ...prev, poolType: value }))}
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
              <Label htmlFor="feeRate">Fee Rate</Label>
              <Select
                value={poolForm.feeRate}
                onValueChange={(value) => setPoolForm(prev => ({ ...prev, feeRate: value }))}
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

          {/* Pool Preview */}
          {calculatedValues.estimatedLPTokens > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                <h4 className="font-medium">Pool Preview</h4>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Estimated LP Tokens</p>
                  <p className="font-semibold">{calculatedValues.estimatedLPTokens.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Initial Price</p>
                  <p className="font-semibold">{calculatedValues.initialPrice.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Minimum Receive</p>
                  <p className="font-semibold">{calculatedValues.minimumReceive.toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Important Information</p>
              <p>Creating a pool requires equal value amounts of both tokens. Make sure you understand impermanent loss risks.</p>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating Pool...' : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Liquidity Pool
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PoolCreator;