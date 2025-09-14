import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, DollarSign, TrendingUp, Building, Gem, Car, Palette, Wrench, Package, RefreshCw, AlertCircle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TokenBalance {
  id: string;
  user_address: string;
  token_symbol: string;
  balance: number;
  updated_at: string;
}

interface Pledge {
  id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_amount: number;
  tx_hash: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'minted';
}

interface PledgeData {
  address: string;
  pledges: Pledge[];
  summary: {
    totalPledges: number;
    totalValue: number;
    totalTokens: number;
    assetTypeBreakdown: Record<string, { count: number; totalValue: number; totalTokens: number }>;
  };
}

interface BalanceData {
  address: string;
  balances: TokenBalance[];
  totalUsdValue: number;
}

interface Transaction {
  id: string;
  type: 'pledge' | 'mint' | 'transfer';
  asset_type?: string;
  amount: number;
  tx_hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
}

const TokenDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [walletAddress, setWalletAddress] = useState('');
  const [pledgeData, setPledgeData] = useState<PledgeData | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const assetTypeIcons = {
    real_estate: Building,
    gold: Gem,
    vehicle: Car,
    art: Palette,
    equipment: Wrench,
    commodity: Package
  } as const;

  const assetTypeLabels = {
    real_estate: 'Real Estate',
    gold: 'Gold',
    vehicle: 'Vehicle',
    art: 'Art & Collectibles',
    equipment: 'Equipment',
    commodity: 'Commodity'
  } as const;

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && walletAddress) {
      intervalRef.current = setInterval(() => {
        fetchUserData(walletAddress, false); // Silent refresh
      }, 30000); // Refresh every 30 seconds

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, walletAddress]);

  // Listen for real-time updates from Supabase
  useEffect(() => {
    if (!user || !walletAddress) return;

    const channel = supabase
      .channel('token-dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pledges',
          filter: `user_address=eq.${walletAddress}`
        },
        (payload) => {
          console.log('Pledge update received:', payload);
          fetchUserData(walletAddress, false);
          toast({
            title: "Update Received",
            description: "Your dashboard has been updated with new data.",
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'token_balances',
          filter: `user_address=eq.${walletAddress}`
        },
        (payload) => {
          console.log('Balance update received:', payload);
          fetchUserData(walletAddress, false);
          toast({
            title: "Balance Updated",
            description: "Your token balances have been updated.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, walletAddress]);

  useEffect(() => {
    // Load user data on component mount
    const loadUserData = async () => {
      if (!user) return;
      
      try {
        // Try to get wallet address from user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('wallet_address')
          .eq('user_id', user.id)
          .single();

        const address = profile?.wallet_address || '0x742d35Cc6634C0532925a3b8D0b5D71c1A37bb2C';
        setWalletAddress(address);
        fetchUserData(address);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    
    loadUserData();
  }, [user]);

  const fetchUserData = async (address: string, showLoading = true) => {
    if (!address) return;
    
    if (showLoading) setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to view your tokens',
          variant: 'destructive'
        });
        return;
      }

      // Fetch pledges
      const { data: pledgesResponse, error: pledgesError } = await supabase.functions.invoke('get-pledges', {
        body: { address }
      });

      if (pledgesError) {
        console.error('Error fetching pledges:', pledgesError);
        toast({
          title: 'Error',
          description: 'Failed to load pledge data',
          variant: 'destructive'
        });
      } else if (pledgesResponse) {
        setPledgeData(pledgesResponse);
      }

      // Fetch token balances
      const { data: balancesResponse, error: balancesError } = await supabase.functions.invoke('get-token-balance', {
        body: { address }
      });

      if (balancesError) {
        console.error('Error fetching balances:', balancesError);
        toast({
          title: 'Error',
          description: 'Failed to load balance data',
          variant: 'destructive'
        });
      } else if (balancesResponse) {
        setBalanceData(balancesResponse);
      }

      // Fetch recent transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_address', address)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
      } else {
        setRecentTransactions(transactions || []);
      }

      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (walletAddress) {
      fetchUserData(walletAddress);
    }
  };

  const handleManualRefresh = () => {
    if (walletAddress) {
      fetchUserData(walletAddress);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'confirmed':
      case 'minted':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
      case 'rejected':
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <Card className="p-6">
          <CardContent className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">Please sign in to view your token dashboard</p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/pledge')}>
              Pledge New Asset
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Coins className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Token Dashboard</h1>
            <p className="text-muted-foreground">
              View your tokenized assets and token balances
            </p>
            {lastUpdated && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Last updated: {formatDate(lastUpdated.toISOString())}
              </div>
            )}
          </div>

          {/* Wallet Address Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Wallet Address
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    Auto-refresh
                  </label>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddressSubmit} className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter wallet address (0x...)"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-md"
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Load Data'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {(pledgeData || balanceData) && (
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pledges</p>
                      <p className="text-2xl font-bold">{pledgeData?.summary.totalPledges || 0}</p>
                    </div>
                    <Building className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Asset Value</p>
                      <p className="text-2xl font-bold">${(pledgeData?.summary.totalValue || 0).toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tokens</p>
                      <p className="text-2xl font-bold">{(pledgeData?.summary.totalTokens || 0).toLocaleString()}</p>
                    </div>
                    <Coins className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Portfolio Value</p>
                      <p className="text-2xl font-bold">${(balanceData?.totalUsdValue || 0).toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          <Tabs defaultValue="pledges" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pledges">Asset Pledges</TabsTrigger>
              <TabsTrigger value="balances">Token Balances</TabsTrigger>
              <TabsTrigger value="transactions">Recent Activity</TabsTrigger>
              <TabsTrigger value="breakdown">Asset Breakdown</TabsTrigger>
            </TabsList>

            <TabsContent value="pledges" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Your Asset Pledges</CardTitle>
                </CardHeader>
                <CardContent>
                  {pledgeData?.pledges.length ? (
                    <div className="space-y-4">
                      {pledgeData.pledges.map((pledge) => {
                        const IconComponent = assetTypeIcons[pledge.asset_type as keyof typeof assetTypeIcons] || Package;
                        return (
                          <div key={pledge.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <IconComponent className="h-8 w-8 text-primary" />
                              <div>
                                <h3 className="font-semibold">
                                  {assetTypeLabels[pledge.asset_type as keyof typeof assetTypeLabels] || pledge.asset_type}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Pledged on {formatDate(pledge.created_at)}
                                </p>
                                <div className="mt-1">
                                  {getStatusBadge(pledge.status)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">${pledge.appraised_value.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                {pledge.token_amount.toLocaleString()} tokens
                              </p>
                              {pledge.tx_hash && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {pledge.tx_hash.substring(0, 10)}...
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No pledged assets found</p>
                      <Button 
                        onClick={() => navigate('/pledge')} 
                        className="mt-4"
                      >
                        Pledge Your First Asset
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balances" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Token Balances</CardTitle>
                </CardHeader>
                <CardContent>
                  {balanceData?.balances.length ? (
                    <div className="space-y-4">
                      {balanceData.balances.map((balance) => (
                        <div key={balance.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Coins className="h-8 w-8 text-primary" />
                            <div>
                              <h3 className="font-semibold">{balance.token_symbol}</h3>
                              <p className="text-sm text-muted-foreground">
                                Last updated: {formatDate(balance.updated_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{balance.balance.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">tokens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No token balances found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentTransactions.length ? (
                    <div className="space-y-4">
                      {recentTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Activity className="h-6 w-6 text-primary" />
                            <div>
                              <h3 className="font-semibold capitalize">{tx.type}</h3>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(tx.created_at)}
                              </p>
                              {tx.tx_hash && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {tx.tx_hash.substring(0, 16)}...
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{tx.amount.toLocaleString()}</p>
                            <div className="mt-1">
                              {getStatusBadge(tx.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No recent transactions found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {pledgeData?.summary.assetTypeBreakdown && Object.entries(pledgeData.summary.assetTypeBreakdown).map(([assetType, data]) => {
                  const IconComponent = assetTypeIcons[assetType as keyof typeof assetTypeIcons] || Package;
                  return (
                    <Card key={assetType}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IconComponent className="h-6 w-6 text-primary" />
                          {assetTypeLabels[assetType as keyof typeof assetTypeLabels] || assetType}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Count:</span>
                            <Badge variant="secondary">{data.count}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Value:</span>
                            <span className="font-semibold">${data.totalValue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Tokens:</span>
                            <span className="font-semibold">{data.totalTokens.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TokenDashboard;