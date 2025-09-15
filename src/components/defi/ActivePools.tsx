import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Droplets, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Users,
  Zap,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';

interface PoolData {
  id: string;
  tokenA: string;
  tokenB: string;
  tvl: number;
  volume24h: number;
  fees24h: number;
  apy: number;
  userLiquidity: number;
  userShare: number;
  priceChange24h: number;
  totalLPs: number;
  isUserPool: boolean;
}

const ActivePools = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  
  const [pools, setPools] = useState<PoolData[]>([
    {
      id: '1',
      tokenA: 'RET',
      tokenB: 'USDC',
      tvl: 125000,
      volume24h: 45000,
      fees24h: 135,
      apy: 24.5,
      userLiquidity: 15500,
      userShare: 12.4,
      priceChange24h: 2.34,
      totalLPs: 125,
      isUserPool: true
    },
    {
      id: '2',
      tokenA: 'GLD',
      tokenB: 'ETH',
      tvl: 89000,
      volume24h: 32000,
      fees24h: 96,
      apy: 18.7,
      userLiquidity: 8900,
      userShare: 10.0,
      priceChange24h: -1.23,
      totalLPs: 89,
      isUserPool: true
    },
    {
      id: '3',
      tokenA: 'ART',
      tokenB: 'USDC',
      tvl: 67000,
      volume24h: 23000,
      fees24h: 69,
      apy: 32.1,
      userLiquidity: 0,
      userShare: 0,
      priceChange24h: 5.67,
      totalLPs: 45,
      isUserPool: false
    }
  ]);

  const [poolStats, setPoolStats] = useState({
    totalTVL: 0,
    totalVolume24h: 0,
    totalFees24h: 0,
    userTotalLiquidity: 0
  });

  const fetchPoolData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Simulate fetching pool data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate stats
      const stats = pools.reduce((acc, pool) => ({
        totalTVL: acc.totalTVL + pool.tvl,
        totalVolume24h: acc.totalVolume24h + pool.volume24h,
        totalFees24h: acc.totalFees24h + pool.fees24h,
        userTotalLiquidity: acc.userTotalLiquidity + pool.userLiquidity
      }), { totalTVL: 0, totalVolume24h: 0, totalFees24h: 0, userTotalLiquidity: 0 });

      setPoolStats(stats);

    } catch (error) {
      console.error('Error fetching pool data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pool data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (poolId: string) => {
    setSelectedPool(poolId);
    // In a real app, this would navigate to a detailed pool page
    toast({
      title: 'Pool Details',
      description: 'Detailed pool analytics would open here',
    });
  };

  useEffect(() => {
    if (user) {
      fetchPoolData();
    }
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Active Liquidity Pools
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchPoolData}
            disabled={loading}
          >
            <Activity className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pool Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">Total TVL</div>
            <div className="font-semibold">{formatCurrency(poolStats.totalTVL)}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">24h Volume</div>
            <div className="font-semibold">{formatCurrency(poolStats.totalVolume24h)}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">24h Fees</div>
            <div className="font-semibold">{formatCurrency(poolStats.totalFees24h)}</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">Your Liquidity</div>
            <div className="font-semibold">{formatCurrency(poolStats.userTotalLiquidity)}</div>
          </div>
        </div>

        {/* Pool List */}
        <div className="space-y-3">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className={`p-4 border rounded-lg transition-all cursor-pointer hover:bg-muted/50 ${
                selectedPool === pool.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => setSelectedPool(pool.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold">{pool.tokenA}</span>
                    </div>
                    <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center -ml-2">
                      <span className="text-xs font-semibold">{pool.tokenB}</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">{pool.tokenA}/{pool.tokenB}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      {pool.totalLPs} LPs
                      {pool.isUserPool && (
                        <Badge variant="secondary" className="text-xs">
                          Your Pool
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{pool.apy.toFixed(1)}% APY</div>
                    <div className="text-sm text-muted-foreground">Annual yield</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(pool.tvl)}</div>
                    <div className="text-sm text-muted-foreground">TVL</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">24h Volume</div>
                  <div className="font-medium">{formatCurrency(pool.volume24h)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">24h Fees</div>
                  <div className="font-medium">{formatCurrency(pool.fees24h)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Price Change</div>
                  <div className={`font-medium ${pool.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(pool.priceChange24h)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Your Share</div>
                  <div className="font-medium">
                    {pool.userShare > 0 ? `${pool.userShare.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>

              {pool.userLiquidity > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Your Position</span>
                    <span className="font-semibold">{formatCurrency(pool.userLiquidity)}</span>
                  </div>
                  <Progress value={pool.userShare} className="h-2" />
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  {pool.apy > 20 && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Zap className="h-3 w-3 mr-1" />
                      High APY
                    </Badge>
                  )}
                  {pool.volume24h > 40000 && (
                    <Badge className="bg-blue-100 text-blue-800">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      High Volume
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(pool.id);
                  }}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Details
                </Button>
              </div>
            </div>
          ))}
        </div>

        {pools.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold mb-2">No Active Pools</h3>
            <p>Create your first liquidity pool to start earning fees</p>
          </div>
        )}

        {/* Pool Performance Chart Placeholder */}
        {selectedPool && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4" />
              <h4 className="font-medium">Pool Performance</h4>
            </div>
            <div className="h-32 bg-white rounded flex items-center justify-center text-muted-foreground">
              📊 Performance chart would appear here
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">
            <Droplets className="h-4 w-4 mr-2" />
            Add Liquidity
          </Button>
          <Button variant="outline" className="flex-1">
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivePools;