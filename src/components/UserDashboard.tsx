import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, FileText, Coins, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Pledge {
  id: string;
  pledge_id?: number;
  user_address: string;
  asset_type: string;
  appraised_value: number;
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
  token_amount?: number;
  nft_token_id?: number;
  admin_notes?: string;
  rejection_reason?: string;
  updated_at?: string;
  tx_hash?: string;
}

interface TokenBalance {
  token_symbol: string;
  balance: number;
}

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

      // Fetch pledges - use user_id if available, fallback to user_address
      const { data: pledgesData, error: pledgesError } = await supabase
        .from('pledges')
        .select('*')
        .eq('user_address', session.session.user.id)
        .order('created_at', { ascending: false });

      if (pledgesError) {
        console.error('Error fetching pledges:', pledgesError);
        setPledges([]);
      } else {
        setPledges(pledgesData || []);
      }

      // Fetch token balances
      const { data: balancesData, error: balancesError } = await supabase
        .from('token_balances')
        .select('*')
        .eq('user_address', session.session.user.id);

      if (balancesError) {
        console.error('Error fetching token balances:', balancesError);
        setTokenBalances([]);
      } else {
        setTokenBalances(balancesData || []);
      }

      // Calculate stats
      const totalPledges = pledgesData?.length || 0;
      const approvedPledges = pledgesData?.filter(p => p.status === 'approved').length || 0;
      const totalValue = pledgesData?.reduce((sum, p) => sum + (p.appraised_value || 0), 0) || 0;
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

      {/* Token Balances */}
      {tokenBalances.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Token Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token Symbol</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokenBalances.map((balance, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{balance.token_symbol}</TableCell>
                    <TableCell>{balance.balance.toFixed(6)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserDashboard;