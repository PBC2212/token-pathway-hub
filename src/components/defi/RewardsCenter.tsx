import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Gift, 
  TrendingUp, 
  Calendar, 
  Star,
  Coins,
  Zap,
  Target,
  ArrowUpRight,
  Clock
} from 'lucide-react';

interface RewardPool {
  id: string;
  name: string;
  token: string;
  totalRewards: number;
  userEarned: number;
  userClaimable: number;
  apy: number;
  endsAt: Date;
  isActive: boolean;
  rewardType: 'trading_fees' | 'liquidity_mining' | 'governance' | 'bonus';
}

interface RewardHistory {
  id: string;
  date: Date;
  amount: number;
  token: string;
  source: string;
  txHash?: string;
}

const RewardsCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [claimingAll, setClaimingAll] = useState(false);
  
  const [rewardPools, setRewardPools] = useState<RewardPool[]>([
    {
      id: '1',
      name: 'RET-USDC Trading Fees',
      token: 'USDC',
      totalRewards: 12500,
      userEarned: 245.50,
      userClaimable: 45.75,
      apy: 24.5,
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      rewardType: 'trading_fees'
    },
    {
      id: '2',
      name: 'Liquidity Mining Program',
      token: 'REWARD',
      totalRewards: 50000,
      userEarned: 125.00,
      userClaimable: 32.50,
      apy: 35.2,
      endsAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      isActive: true,
      rewardType: 'liquidity_mining'
    },
    {
      id: '3',
      name: 'Governance Participation',
      token: 'GOV',
      totalRewards: 25000,
      userEarned: 75.00,
      userClaimable: 15.25,
      apy: 12.8,
      endsAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isActive: true,
      rewardType: 'governance'
    },
    {
      id: '4',
      name: 'New User Bonus',
      token: 'USDC',
      totalRewards: 5000,
      userEarned: 100.00,
      userClaimable: 100.00,
      apy: 0,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      rewardType: 'bonus'
    }
  ]);

  const [rewardHistory, setRewardHistory] = useState<RewardHistory[]>([
    {
      id: '1',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      amount: 25.50,
      token: 'USDC',
      source: 'Trading Fees',
      txHash: '0x123...abc'
    },
    {
      id: '2',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      amount: 15.75,
      token: 'REWARD',
      source: 'Liquidity Mining',
      txHash: '0x456...def'
    },
    {
      id: '3',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      amount: 50.00,
      token: 'USDC',
      source: 'New User Bonus',
      txHash: '0x789...ghi'
    }
  ]);

  const totalClaimable = rewardPools.reduce((sum, pool) => sum + pool.userClaimable, 0);
  const totalEarned = rewardPools.reduce((sum, pool) => sum + pool.userEarned, 0);

  const handleClaimReward = async (poolId: string) => {
    const pool = rewardPools.find(p => p.id === poolId);
    if (!pool || pool.userClaimable === 0) return;

    try {
      setLoading(true);
      
      // Simulate claiming reward
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add to history
      const newHistoryEntry: RewardHistory = {
        id: Date.now().toString(),
        date: new Date(),
        amount: pool.userClaimable,
        token: pool.token,
        source: pool.name,
        txHash: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 3)}`
      };

      setRewardHistory(prev => [newHistoryEntry, ...prev]);

      // Update pool claimable amount
      setRewardPools(prev => prev.map(p => 
        p.id === poolId ? { ...p, userClaimable: 0 } : p
      ));

      toast({
        title: 'Rewards Claimed!',
        description: `Successfully claimed ${pool.userClaimable.toFixed(2)} ${pool.token}`,
      });

    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: 'Claim Failed',
        description: 'Failed to claim rewards. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAll = async () => {
    const claimablePools = rewardPools.filter(pool => pool.userClaimable > 0);
    if (claimablePools.length === 0) return;

    try {
      setClaimingAll(true);
      
      // Simulate claiming all rewards
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Add all to history
      const newHistoryEntries: RewardHistory[] = claimablePools.map(pool => ({
        id: `${Date.now()}-${pool.id}`,
        date: new Date(),
        amount: pool.userClaimable,
        token: pool.token,
        source: pool.name,
        txHash: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 3)}`
      }));

      setRewardHistory(prev => [...newHistoryEntries, ...prev]);

      // Clear all claimable amounts
      setRewardPools(prev => prev.map(pool => ({ ...pool, userClaimable: 0 })));

      toast({
        title: 'All Rewards Claimed!',
        description: `Successfully claimed rewards from ${claimablePools.length} pools`,
      });

    } catch (error) {
      console.error('Error claiming all rewards:', error);
      toast({
        title: 'Claim Failed',
        description: 'Failed to claim all rewards. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setClaimingAll(false);
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'trading_fees': return TrendingUp;
      case 'liquidity_mining': return Target;
      case 'governance': return Star;
      case 'bonus': return Gift;
      default: return Coins;
    }
  };

  const getRewardColor = (type: string) => {
    switch (type) {
      case 'trading_fees': return 'bg-blue-100 text-blue-800';
      case 'liquidity_mining': return 'bg-green-100 text-green-800';
      case 'governance': return 'bg-purple-100 text-purple-800';
      case 'bonus': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysRemaining = (endDate: Date) => {
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Claimable</p>
                <p className="text-2xl font-bold">${totalClaimable.toFixed(2)}</p>
              </div>
              <Gift className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold">${totalEarned.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Pools</p>
                <p className="text-2xl font-bold">{rewardPools.filter(p => p.isActive).length}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claim All Button */}
      {totalClaimable > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-green-900">Ready to Claim</h3>
                <p className="text-green-700">
                  You have ${totalClaimable.toFixed(2)} in claimable rewards across {rewardPools.filter(p => p.userClaimable > 0).length} pools
                </p>
              </div>
              <Button 
                onClick={handleClaimAll}
                disabled={claimingAll}
                className="bg-green-600 hover:bg-green-700"
              >
                {claimingAll ? 'Claiming...' : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Claim All Rewards
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Reward Pools */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Active Reward Pools</h3>
        
        <div className="grid gap-4">
          {rewardPools.filter(pool => pool.isActive).map((pool) => {
            const IconComponent = getRewardIcon(pool.rewardType);
            const daysRemaining = getDaysRemaining(pool.endsAt);
            const progress = Math.max(0, Math.min(100, (pool.userEarned / pool.totalRewards) * 100));

            return (
              <Card key={pool.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {pool.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getRewardColor(pool.rewardType)}>
                        {pool.rewardType.replace('_', ' ')}
                      </Badge>
                      {pool.apy > 0 && (
                        <Badge variant="secondary">
                          {pool.apy.toFixed(1)}% APY
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pool</p>
                      <p className="font-semibold">{pool.totalRewards.toLocaleString()} {pool.token}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Your Earned</p>
                      <p className="font-semibold">{pool.userEarned.toFixed(2)} {pool.token}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Claimable</p>
                      <p className="font-semibold text-green-600">{pool.userClaimable.toFixed(2)} {pool.token}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time Left</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysRemaining}d
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Your Progress</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Ends {pool.endsAt.toLocaleDateString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleClaimReward(pool.id)}
                      disabled={loading || pool.userClaimable === 0}
                    >
                      <Gift className="h-4 w-4 mr-2" />
                      Claim {pool.userClaimable.toFixed(2)} {pool.token}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reward History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reward History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rewardHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold mb-2">No Reward History</h3>
              <p>Your claimed rewards will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rewardHistory.slice(0, 10).map((reward) => (
                <div key={reward.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Gift className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="font-medium">{reward.source}</div>
                      <div className="text-sm text-muted-foreground">
                        {reward.date.toLocaleDateString()} at {reward.date.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">+{reward.amount.toFixed(2)} {reward.token}</div>
                    {reward.txHash && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {reward.txHash}
                        <ArrowUpRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {rewardHistory.length > 10 && (
                <div className="text-center">
                  <Button variant="outline" size="sm">
                    View All History
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bonus Programs */}
      <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-600" />
            Bonus Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
              <div>
                <div className="font-medium">Double Rewards Weekend</div>
                <div className="text-sm text-muted-foreground">
                  Earn 2x rewards on all liquidity mining pools
                </div>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">
                Coming Soon
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
              <div>
                <div className="font-medium">Referral Program</div>
                <div className="text-sm text-muted-foreground">
                  Earn 10% of your referrals' rewards
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RewardsCenter;