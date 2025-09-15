import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Wallet, 
  Coins, 
  Droplets, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Target,
  Zap,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

// Components
import WalletConnector from '@/components/defi/WalletConnector';
import AssetOverview from '@/components/defi/AssetOverview';
import PoolCreator from '@/components/defi/PoolCreator';
import StakingManager from '@/components/defi/StakingManager';
import RewardsCenter from '@/components/defi/RewardsCenter';
import ActivePools from '@/components/defi/ActivePools';

interface DashboardStats {
  totalWalletValue: number;
  totalStaked: number;
  totalRewards: number;
  totalPools: number;
  avgAPY: number;
  weeklyChange: number;
}

const DeFiDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalWalletValue: 0,
    totalStaked: 0,
    totalRewards: 0,
    totalPools: 0,
    avgAPY: 0,
    weeklyChange: 0
  });

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      // Simulate fetching comprehensive dashboard data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // This would normally fetch real data from multiple sources
      setDashboardStats({
        totalWalletValue: 125000,
        totalStaked: 85000,
        totalRewards: 2350,
        totalPools: 3,
        avgAPY: 12.5,
        weeklyChange: 5.2
      });

      toast({
        title: 'Dashboard Updated',
        description: 'Successfully refreshed all data'
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  const statCards = [
    {
      title: 'Total Portfolio Value',
      value: `$${dashboardStats.totalWalletValue.toLocaleString()}`,
      change: `+${dashboardStats.weeklyChange}%`,
      icon: DollarSign,
      trend: 'up'
    },
    {
      title: 'Total Staked',
      value: `$${dashboardStats.totalStaked.toLocaleString()}`,
      change: `${dashboardStats.totalPools} pools`,
      icon: Target,
      trend: 'neutral'
    },
    {
      title: 'Total Rewards Earned',
      value: `$${dashboardStats.totalRewards.toLocaleString()}`,
      change: 'This month',
      icon: Gift,
      trend: 'up'
    },
    {
      title: 'Average APY',
      value: `${dashboardStats.avgAPY}%`,
      change: 'Across all pools',
      icon: TrendingUp,
      trend: 'up'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                DeFi Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Complete DeFi experience: Pledge → Mint → Pool → Stake → Earn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={refreshDashboard}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <WalletConnector />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {stat.trend === 'up' && <ArrowUpRight className="h-3 w-3 text-green-500" />}
                  {stat.trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="pools" className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Pools
            </TabsTrigger>
            <TabsTrigger value="staking" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Staking
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="mint" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Mint
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <AssetOverview />
              <ActivePools />
            </div>
            <div className="grid lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('pools')}
                  >
                    <Droplets className="h-4 w-4 mr-2" />
                    Create New Pool
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('staking')}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Stake LP Tokens
                  </Button>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                    onClick={() => setActiveTab('rewards')}
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Claim Rewards
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Portfolio Growth</span>
                      <span className="text-green-600">+12.5%</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Staking Efficiency</span>
                      <span className="text-blue-600">89%</span>
                    </div>
                    <Progress value={89} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Staked LP tokens</span>
                    <Badge variant="secondary">2h ago</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Created new pool</span>
                    <Badge variant="secondary">1d ago</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Claimed rewards</span>
                    <Badge variant="secondary">3d ago</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wallet">
            <AssetOverview />
          </TabsContent>

          <TabsContent value="pools">
            <div className="space-y-6">
              <PoolCreator />
              <ActivePools />
            </div>
          </TabsContent>

          <TabsContent value="staking">
            <StakingManager />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardsCenter />
          </TabsContent>

          <TabsContent value="mint">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Minting</CardTitle>
                  <p className="text-muted-foreground">
                    Mint tokens from your approved asset pledges to use in DeFi
                  </p>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => window.location.href = '/mint'} className="w-full">
                    Go to Token Minting
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DeFiDashboard;