import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Coins, DollarSign, TrendingUp, Building, Gem, Car, Palette, Wrench, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

const TokenDashboard = () => {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState('');
  const [pledgeData, setPledgeData] = useState<PledgeData | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    // Try to load wallet address from localStorage or user profile
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // In a real app, you'd get the wallet address from user profile
        // For demo purposes, we'll use a placeholder
        const demoAddress = '0x742d35Cc6634C0532925a3b8D0b5D71c1A37bb2C';
        setWalletAddress(demoAddress);
        fetchUserData(demoAddress);
      }
    };
    
    loadUserData();
  }, []);

  const fetchUserData = async (address: string) => {
    if (!address) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
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
      } else {
        setPledgeData(pledgesResponse);
      }

      // Fetch token balances
      const { data: balancesResponse, error: balancesError } = await supabase.functions.invoke('get-token-balance', {
        body: { address }
      });

      if (balancesError) {
        console.error('Error fetching balances:', balancesError);
      } else {
        setBalanceData(balancesResponse);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (walletAddress) {
      fetchUserData(walletAddress);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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

          <Button onClick={() => navigate('/pledge')}>
            Pledge New Asset
          </Button>
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
          </div>

          {/* Wallet Address Input */}
          <Card>
            <CardHeader>
              <CardTitle>Wallet Address</CardTitle>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pledges">Asset Pledges</TabsTrigger>
              <TabsTrigger value="balances">Token Balances</TabsTrigger>
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
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">${pledge.appraised_value.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                {pledge.token_amount.toLocaleString()} tokens
                              </p>
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