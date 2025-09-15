import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Target, 
  TrendingUp, 
  Clock, 
  Zap,
  Lock,
  Unlock,
  Calculator,
  Gift
} from 'lucide-react';

interface LPToken {
  symbol: string;
  balance: number;
  poolAddress: string;
  apy: number;
  totalStaked: number;
  totalRewards: number;
}

interface StakingPosition {
  id: string;
  poolSymbol: string;
  stakedAmount: number;
  currentValue: number;
  dailyRewards: number;
  apy: number;
  lockupEnd: Date | null;
  autoCompound: boolean;
  totalEarned: number;
}

const StakingManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stake' | 'positions'>('positions');
  
  const [lpTokens, setLpTokens] = useState<LPToken[]>([
    {
      symbol: 'RET-USDC LP',
      balance: 150.5,
      poolAddress: '0x123...',
      apy: 24.5,
      totalStaked: 1000000,
      totalRewards: 50000
    },
    {
      symbol: 'GLD-ETH LP',
      balance: 89.2,
      poolAddress: '0x456...',
      apy: 18.7,
      totalStaked: 750000,
      totalRewards: 35000
    }
  ]);

  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([
    {
      id: '1',
      poolSymbol: 'RET-USDC LP',
      stakedAmount: 100.0,
      currentValue: 10250,
      dailyRewards: 6.85,
      apy: 24.5,
      lockupEnd: null,
      autoCompound: true,
      totalEarned: 245.50
    }
  ]);

  const [stakeForm, setStakeForm] = useState({
    tokenSymbol: '',
    amount: '',
    lockupPeriod: '0', // 0, 30, 90, 180 days
    autoCompound: true
  });

  const [rewardCalculation, setRewardCalculation] = useState({
    dailyReward: 0,
    monthlyReward: 0,
    yearlyReward: 0,
    bonusApy: 0
  });

  const calculateRewards = () => {
    const amount = parseFloat(stakeForm.amount) || 0;
    const selectedToken = lpTokens.find(token => token.symbol === stakeForm.tokenSymbol);
    
    if (amount > 0 && selectedToken) {
      const baseApy = selectedToken.apy;
      const lockupBonus = getLockupBonus(parseInt(stakeForm.lockupPeriod));
      const totalApy = baseApy + lockupBonus;
      
      const yearlyReward = (amount * (totalApy / 100));
      const monthlyReward = yearlyReward / 12;
      const dailyReward = yearlyReward / 365;

      setRewardCalculation({
        dailyReward,
        monthlyReward,
        yearlyReward,
        bonusApy: lockupBonus
      });
    } else {
      setRewardCalculation({
        dailyReward: 0,
        monthlyReward: 0,
        yearlyReward: 0,
        bonusApy: 0
      });
    }
  };

  const getLockupBonus = (days: number): number => {
    switch (days) {
      case 30: return 2.0;
      case 90: return 5.0;
      case 180: return 8.0;
      default: return 0;
    }
  };

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stakeForm.tokenSymbol || !stakeForm.amount) {
      toast({
        title: 'Missing Information',
        description: 'Please select a token and enter an amount',
        variant: 'destructive'
      });
      return;
    }

    const amount = parseFloat(stakeForm.amount);
    const selectedToken = lpTokens.find(token => token.symbol === stakeForm.tokenSymbol);
    
    if (!selectedToken || amount > selectedToken.balance) {
      toast({
        title: 'Insufficient Balance',
        description: 'You don\'t have enough LP tokens to stake',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Simulate staking transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      const lockupEnd = stakeForm.lockupPeriod !== '0' 
        ? new Date(Date.now() + parseInt(stakeForm.lockupPeriod) * 24 * 60 * 60 * 1000)
        : null;

      const newPosition: StakingPosition = {
        id: Date.now().toString(),
        poolSymbol: stakeForm.tokenSymbol,
        stakedAmount: amount,
        currentValue: amount * 102.5, // Mock current value
        dailyRewards: rewardCalculation.dailyReward,
        apy: selectedToken.apy + rewardCalculation.bonusApy,
        lockupEnd,
        autoCompound: stakeForm.autoCompound,
        totalEarned: 0
      };

      setStakingPositions(prev => [...prev, newPosition]);

      // Update LP token balance
      setLpTokens(prev => prev.map(token => 
        token.symbol === stakeForm.tokenSymbol 
          ? { ...token, balance: token.balance - amount }
          : token
      ));

      toast({
        title: 'Staking Successful!',
        description: `Staked ${amount} ${stakeForm.tokenSymbol} tokens`
      });

      // Reset form
      setStakeForm({
        tokenSymbol: '',
        amount: '',
        lockupPeriod: '0',
        autoCompound: true
      });

    } catch (error) {
      console.error('Error staking:', error);
      toast({
        title: 'Staking Failed',
        description: 'There was an error staking your tokens',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async (positionId: string) => {
    try {
      setLoading(true);
      
      // Simulate claiming rewards
      await new Promise(resolve => setTimeout(resolve, 1500));

      const position = stakingPositions.find(p => p.id === positionId);
      if (position) {
        toast({
          title: 'Rewards Claimed!',
          description: `Claimed $${position.totalEarned.toFixed(2)} in rewards`
        });

        // Reset rewards for this position
        setStakingPositions(prev => prev.map(p => 
          p.id === positionId ? { ...p, totalEarned: 0 } : p
        ));
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast({
        title: 'Claim Failed',
        description: 'Failed to claim rewards',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (positionId: string) => {
    const position = stakingPositions.find(p => p.id === positionId);
    if (!position) return;

    if (position.lockupEnd && position.lockupEnd > new Date()) {
      toast({
        title: 'Position Locked',
        description: 'This position is still in lockup period',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Simulate unstaking
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove position and return LP tokens
      setStakingPositions(prev => prev.filter(p => p.id !== positionId));
      setLpTokens(prev => prev.map(token => 
        token.symbol === position.poolSymbol 
          ? { ...token, balance: token.balance + position.stakedAmount }
          : token
      ));

      toast({
        title: 'Unstaking Successful!',
        description: `Unstaked ${position.stakedAmount} ${position.poolSymbol} tokens`
      });

    } catch (error) {
      console.error('Error unstaking:', error);
      toast({
        title: 'Unstaking Failed',
        description: 'Failed to unstake tokens',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateRewards();
  }, [stakeForm.amount, stakeForm.tokenSymbol, stakeForm.lockupPeriod]);

  const totalStakedValue = stakingPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
  const totalDailyRewards = stakingPositions.reduce((sum, pos) => sum + pos.dailyRewards, 0);
  const totalEarned = stakingPositions.reduce((sum, pos) => sum + pos.totalEarned, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staked</p>
                <p className="text-2xl font-bold">${totalStakedValue.toLocaleString()}</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily Rewards</p>
                <p className="text-2xl font-bold">${totalDailyRewards.toFixed(2)}</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
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
              <Gift className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Positions</p>
                <p className="text-2xl font-bold">{stakingPositions.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'positions' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('positions')}
        >
          My Positions
        </Button>
        <Button
          variant={activeTab === 'stake' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('stake')}
        >
          Stake Tokens
        </Button>
      </div>

      {activeTab === 'positions' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Staking Positions</h3>
          
          {stakingPositions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Staking Positions</h3>
                <p className="text-muted-foreground mb-4">
                  Start staking your LP tokens to earn rewards
                </p>
                <Button onClick={() => setActiveTab('stake')}>
                  <Target className="h-4 w-4 mr-2" />
                  Start Staking
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {stakingPositions.map((position) => (
                <Card key={position.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        {position.poolSymbol}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {position.apy.toFixed(1)}% APY
                        </Badge>
                        {position.lockupEnd && position.lockupEnd > new Date() && (
                          <Badge variant="outline">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                        {position.autoCompound && (
                          <Badge className="bg-green-100 text-green-800">
                            <Zap className="h-3 w-3 mr-1" />
                            Auto-compound
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Staked Amount</p>
                        <p className="font-semibold">{position.stakedAmount.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Value</p>
                        <p className="font-semibold">${position.currentValue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Daily Rewards</p>
                        <p className="font-semibold text-green-600">${position.dailyRewards.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Earned</p>
                        <p className="font-semibold text-yellow-600">${position.totalEarned.toFixed(2)}</p>
                      </div>
                    </div>

                    {position.lockupEnd && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Lockup Progress</span>
                          <span>{position.lockupEnd > new Date() ? 'Locked' : 'Unlocked'}</span>
                        </div>
                        <Progress 
                          value={position.lockupEnd > new Date() ? 45 : 100} 
                          className="h-2" 
                        />
                        <p className="text-xs text-muted-foreground">
                          {position.lockupEnd > new Date() 
                            ? `Unlocks on ${position.lockupEnd.toLocaleDateString()}`
                            : 'Position is unlocked'
                          }
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleClaimRewards(position.id)}
                        disabled={loading || position.totalEarned === 0}
                      >
                        <Gift className="h-4 w-4 mr-2" />
                        Claim Rewards
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnstake(position.id)}
                        disabled={loading || (position.lockupEnd && position.lockupEnd > new Date())}
                      >
                        <Unlock className="h-4 w-4 mr-2" />
                        Unstake
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stake' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Stake LP Tokens
            </CardTitle>
            <p className="text-muted-foreground">
              Stake your LP tokens to earn additional rewards on top of trading fees
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStake} className="space-y-6">
              <div className="space-y-2">
                <Label>Select LP Token</Label>
                <div className="grid gap-2">
                  {lpTokens.map((token) => (
                    <div
                      key={token.symbol}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        stakeForm.tokenSymbol === token.symbol
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => setStakeForm(prev => ({ ...prev, tokenSymbol: token.symbol }))}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-sm text-muted-foreground">
                            Balance: {token.balance.toFixed(4)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">{token.apy}% APY</div>
                          <div className="text-sm text-muted-foreground">
                            ${token.totalStaked.toLocaleString()} TVL
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount to Stake</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    value={stakeForm.amount}
                    onChange={(e) => setStakeForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lockup">Lockup Period</Label>
                  <select
                    id="lockup"
                    className="w-full p-2 border rounded-md"
                    value={stakeForm.lockupPeriod}
                    onChange={(e) => setStakeForm(prev => ({ ...prev, lockupPeriod: e.target.value }))}
                  >
                    <option value="0">No lockup (0% bonus)</option>
                    <option value="30">30 days (+2% APY)</option>
                    <option value="90">90 days (+5% APY)</option>
                    <option value="180">180 days (+8% APY)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="autoCompound">Auto-compound rewards</Label>
                <Switch
                  id="autoCompound"
                  checked={stakeForm.autoCompound}
                  onCheckedChange={(checked) => setStakeForm(prev => ({ ...prev, autoCompound: checked }))}
                />
              </div>

              {rewardCalculation.dailyReward > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    <h4 className="font-medium">Reward Calculation</h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Daily</p>
                      <p className="font-semibold">${rewardCalculation.dailyReward.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly</p>
                      <p className="font-semibold">${rewardCalculation.monthlyReward.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Yearly</p>
                      <p className="font-semibold">${rewardCalculation.yearlyReward.toFixed(2)}</p>
                    </div>
                  </div>
                  {rewardCalculation.bonusApy > 0 && (
                    <p className="text-sm text-green-600">
                      +{rewardCalculation.bonusApy}% APY bonus from lockup period
                    </p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Staking...' : 'Stake LP Tokens'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StakingManager;