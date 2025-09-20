import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, FileText, Coins, TrendingUp, Building, Gem, FileText as FileTextIcon, Wrench, Package, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Pledge {
  id: string;
  pledge_id?: number;
  user_id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number; // Normalized to number
  token_symbol?: string;
  contract_address?: string;
  description?: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
  status: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  token_amount?: number; // Normalized to number
  nft_token_id?: number;
  admin_notes?: string;
  rejection_reason?: string;
  updated_at?: string;
  tx_hash?: string;
  // Multi-token fields
  rwa_category?: string;
  category_token_symbol?: string;
  ltv_ratio?: number; // Add missing field for TS compatibility
  is_redeemable?: boolean;
}

interface TokenBalance {
  token_symbol: string;
  balance: number;
  category?: string;
  token_name?: string;
  updated_at?: string;
}

// Category helpers for multi-token system
const getCategoryIcon = (tokenSymbol: string) => {
  switch (tokenSymbol) {
    case 'RUSD': return Building;
    case 'CUSD': return Gem;
    case 'BUSD': return FileTextIcon;
    case 'EUSD': return Wrench;
    case 'IUSD': return Package;
    case 'OUSD': return Archive;
    default: return Coins;
  }
};

const getCategoryName = (tokenSymbol: string) => {
  switch (tokenSymbol) {
    case 'RUSD': return 'Real Estate';
    case 'CUSD': return 'Commodities';
    case 'BUSD': return 'Bonds';
    case 'EUSD': return 'Equipment';
    case 'IUSD': return 'Inventory';
    case 'OUSD': return 'Other Assets';
    default: return 'Unknown';
  }
};

const getCategoryColor = (tokenSymbol: string) => {
  switch (tokenSymbol) {
    case 'RUSD': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CUSD': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'BUSD': return 'bg-green-100 text-green-800 border-green-200';
    case 'EUSD': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'IUSD': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'OUSD': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const UserDashboard = () => {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPledges: 0,
    approvedPledges: 0,
    totalValue: 0,
    tokenBalance: 0
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        throw new Error('Not authenticated');
      }

      // SECURITY FIX: Use secure edge functions instead of direct database queries
      
      // Fetch pledges using secure get-pledges function
      const { data: pledgesResponse, error: pledgesError } = await supabase.functions.invoke('get-pledges', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      let normalizedPledges: Pledge[] = [];
      
      if (pledgesError) {
        console.error('Error fetching pledges:', pledgesError);
        setPledges([]);
      } else {
        // Use pledges from secure function response
        const pledgesData = pledgesResponse?.pledges || [];
        normalizedPledges = pledgesData.map((pledge: any) => ({
          ...pledge,
          appraised_value: parseFloat(pledge.appraised_value?.toString() || '0') || 0,
          token_amount: parseFloat(pledge.token_amount?.toString() || '0') || 0,
          ltv_ratio: parseInt(pledge.ltv_ratio?.toString() || '8000') || 8000
        }));
        setPledges(normalizedPledges);
      }

      // Fetch token balances using new secure user-only function
      const { data: balanceResponse, error: balanceError } = await supabase.functions.invoke('get-token-balance-user-only', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      let balancesData = [];
      
      if (balanceError) {
        console.error('Error fetching token balances:', balanceError);
        setTokenBalances([]);
      } else {
        // Use balances from secure function response
        balancesData = balanceResponse?.balances?.map((balance: any) => ({
          ...balance,
          balance: parseFloat(balance.balance?.toString() || '0')
        })) || [];
        setTokenBalances(balancesData);
      }

      // Calculate stats using normalized data for correct numeric calculations
      const totalPledges = normalizedPledges?.length || 0;
      const approvedPledges = normalizedPledges?.filter(p => p.status === 'approved').length || 0;
      const totalValue = normalizedPledges?.reduce((sum, p) => sum + (p.appraised_value || 0), 0) || 0;
      const tokenBalance = balancesData?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

      setStats({
        totalPledges,
        approvedPledges,
        totalValue,
        tokenBalance
      });

    } catch (error: any) {
      console.error('Error fetching user data:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: error.message || 'Failed to load dashboard data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending' },
      approved: { variant: 'default' as const, label: 'Approved' },
      rejected: { variant: 'destructive' as const, label: 'Rejected' },
      tokens_minted: { variant: 'default' as const, label: 'Tokens Minted' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pledges</p>
                <p className="text-2xl font-bold">{stats.totalPledges}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approvedPledges}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
              </div>
              <Wallet className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Token Balance</p>
                <p className="text-2xl font-bold">{stats.tokenBalance.toFixed(2)}</p>
              </div>
              <Coins className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pledges Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Pledges</CardTitle>
        </CardHeader>
        <CardContent>
          {pledges.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pledges Yet</h3>
              <p className="text-muted-foreground">Create your first asset pledge to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Token Symbol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Token Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges.map((pledge) => (
                  <TableRow key={pledge.id}>
                    <TableCell className="font-medium">
                      {pledge.asset_type?.replace('_', ' ').toUpperCase() || 'Unknown'}
                    </TableCell>
                    <TableCell>{formatCurrency(pledge.appraised_value)}</TableCell>
                    <TableCell>{pledge.token_symbol || '-'}</TableCell>
                    <TableCell>{getStatusBadge(pledge.status)}</TableCell>
                    <TableCell>{formatDate(pledge.created_at)}</TableCell>
                    <TableCell>
                      {pledge.token_amount ? pledge.token_amount.toFixed(2) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Multi-Token Balances */}
      {tokenBalances.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Multi-Token Portfolio
              <Badge variant="outline" className="text-xs">Category-Based</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tokenBalances.map((balance, index) => {
                const CategoryIcon = getCategoryIcon(balance.token_symbol);
                const categoryName = getCategoryName(balance.token_symbol);
                const colorClass = getCategoryColor(balance.token_symbol);
                
                return (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-5 w-5 text-blue-600" />
                          <Badge className={colorClass + ' text-xs font-mono'}>
                            {balance.token_symbol}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {balance.balance.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {balance.token_symbol}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Category:</span>
                          <span className="font-medium">{categoryName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">USD Value:</span>
                          <span className="font-medium text-green-600">
                            ${balance.balance.toFixed(2)}
                          </span>
                        </div>
                        {balance.updated_at && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Updated: {formatDate(balance.updated_at)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {/* Total Portfolio Value */}
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-semibold">Total Portfolio Value</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    ${tokenBalances.reduce((sum, balance) => sum + balance.balance, 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Across {tokenBalances.length} token{tokenBalances.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserDashboard;