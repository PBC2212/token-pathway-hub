import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Coins, 
  Eye, 
  FileText, 
  Shield, 
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Plus,
  Wallet,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UserPledge {
  id: string;
  pledge_id: number;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash: string;
  appraisal_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'tokens_minted' | 'defaulted';
  created_at: string;
  approved_at?: string;
  token_amount?: number;
  nft_token_id?: number;
  rejection_reason?: string;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  contractAddress: string;
  assetType: string;
}

interface NFTAsset {
  tokenId: number;
  pledgeId: number;
  assetType: string;
  appraisedValue: number;
  documentHash: string;
  contractAddress: string;
}

const UserDashboard = () => {
  const navigate = useNavigate();
  const [pledges, setPledges] = useState<UserPledge[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [nftAssets, setNftAssets] = useState<NFTAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [blockchainFeaturesAvailable, setBlockchainFeaturesAvailable] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      loadUserData(session.user.id);
    } else {
      navigate('/auth');
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Load user pledges - this should always work
      const { data: pledgesData, error: pledgesError } = await supabase
        .from('pledges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (pledgesError) {
        console.error('Error loading pledges:', pledgesError);
        toast({
          title: 'Error',
          description: 'Failed to load your pledges',
          variant: 'destructive'
        });
        return;
      }

      setPledges(pledgesData || []);

      // Check if blockchain features are available
      await checkBlockchainFeatures();

      // Load blockchain data if available
      if (blockchainFeaturesAvailable && pledgesData?.length > 0) {
        await loadBlockchainData(pledgesData);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBlockchainFeatures = async () => {
    try {
      // Check if Fireblocks is connected
      const { data } = await supabase.functions.invoke('check-fireblocks-status');
      setBlockchainFeaturesAvailable(data?.connected || false);
    } catch (error) {
      console.error('Blockchain features check failed:', error);
      setBlockchainFeaturesAvailable(false);
    }
  };

  const loadBlockchainData = async (pledgesData: UserPledge[]) => {
    // Get unique wallet addresses from pledges
    const walletAddresses = [...new Set(pledgesData.map(p => p.user_address))];
    
    if (walletAddresses.length === 0) return;

    // For now, use the first wallet address
    const primaryWallet = walletAddresses[0];

    try {
      // Load token balances
      await loadTokenBalances(primaryWallet);
      // Load NFT assets
      await loadNFTAssets(primaryWallet);
    } catch (error) {
      console.error('Error loading blockchain data:', error);
    }
  };

  const loadTokenBalances = async (walletAddress: string) => {
    try {
      // Try to call the get-token-balances function
      const { data: balances, error } = await supabase.functions.invoke('get-token-balances', {
        body: { walletAddress }
      });

      if (error) {
        console.warn('Token balances function not available:', error);
        // Create mock data based on minted pledges
        const mockBalances: TokenBalance[] = pledges
          .filter(p => p.status === 'tokens_minted' && p.token_amount)
          .map(p => ({
            symbol: p.token_symbol,
            balance: p.token_amount || 0,
            contractAddress: p.contract_address,
            assetType: p.asset_type
          }));
        setTokenBalances(mockBalances);
        return;
      }

      setTokenBalances(balances || []);
    } catch (error) {
      console.warn('Error loading token balances, using fallback:', error);
      // Fallback: create balances from pledge data
      const fallbackBalances: TokenBalance[] = pledges
        .filter(p => p.status === 'tokens_minted' && p.token_amount)
        .map(p => ({
          symbol: p.token_symbol,
          balance: p.token_amount || 0,
          contractAddress: p.contract_address,
          assetType: p.asset_type
        }));
      setTokenBalances(fallbackBalances);
    }
  };

  const loadNFTAssets = async (walletAddress: string) => {
    try {
      // Try to call the get-nft-assets function
      const { data: assets, error } = await supabase.functions.invoke('get-nft-assets', {
        body: { walletAddress }
      });

      if (error) {
        console.warn('NFT assets function not available:', error);
        // Create mock data based on pledges
        const mockAssets: NFTAsset[] = pledges
          .filter(p => p.nft_token_id)
          .map(p => ({
            tokenId: p.nft_token_id || 0,
            pledgeId: p.pledge_id,
            assetType: p.asset_type,
            appraisedValue: p.appraised_value,
            documentHash: p.document_hash,
            contractAddress: p.contract_address
          }));
        setNftAssets(mockAssets);
        return;
      }

      setNftAssets(assets || []);
    } catch (error) {
      console.warn('Error loading NFT assets, using fallback:', error);
      // Fallback: create NFT data from pledge data
      const fallbackAssets: NFTAsset[] = pledges
        .filter(p => p.nft_token_id)
        .map(p => ({
          tokenId: p.nft_token_id || 0,
          pledgeId: p.pledge_id,
          assetType: p.asset_type,
          appraisedValue: p.appraised_value,
          documentHash: p.document_hash,
          contractAddress: p.contract_address
        }));
      setNftAssets(fallbackAssets);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    
    setRefreshing(true);
    await loadUserData(user.id);
    setRefreshing(false);
    
    toast({
      title: 'Dashboard Refreshed',
      description: 'Latest data loaded successfully',
    });
  };

  const handleRedeemTokens = async (pledge: UserPledge) => {
    if (!blockchainFeaturesAvailable) {
      toast({
        title: 'Feature Unavailable',
        description: 'Blockchain features are currently unavailable. Please try again later.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('redeem-pledge', {
        body: {
          pledgeId: pledge.pledge_id,
          tokenAmount: pledge.token_amount,
          escrowContract: pledge.contract_address
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: 'Redemption Started',
        description: 'Token redemption transaction submitted to blockchain',
      });

      handleRefresh();

    } catch (error) {
      console.error('Error redeeming tokens:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        toast({
          title: 'Feature Not Available',
          description: 'Token redemption feature is not yet implemented. Please contact support.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Redemption Failed',
          description: 'Failed to redeem tokens. Please try again.',
          variant: 'destructive'
        });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', icon: Clock, label: 'Under Review' },
      approved: { color: 'bg-blue-500', icon: CheckCircle, label: 'Approved' },
      rejected: { color: 'bg-red-500', icon: XCircle, label: 'Rejected' },
      tokens_minted: { color: 'bg-green-500', icon: Coins, label: 'Active' },
      defaulted: { color: 'bg-gray-500', icon: AlertTriangle, label: 'Defaulted' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getStatusDescription = (status: string) => {
    const descriptions = {
      pending: 'Your pledge is being reviewed by our team',
      approved: 'Your pledge has been approved and is ready for token minting',
      rejected: 'Your pledge was rejected. Please review the reason and submit a new pledge',
      tokens_minted: 'Tokens have been minted to your wallet. You can now trade or redeem them',
      defaulted: 'This pledge has been marked as defaulted'
    };

    return descriptions[status as keyof typeof descriptions] || 'Status unknown';
  };

  const stats = {
    totalPledges: pledges.length,
    activePledges: pledges.filter(p => p.status === 'tokens_minted').length,
    pendingPledges: pledges.filter(p => p.status === 'pending').length,
    totalValue: pledges.reduce((sum, p) => sum + p.appraised_value, 0),
    totalTokens: tokenBalances.reduce((sum, t) => sum + t.balance, 0),
    nftCount: nftAssets.length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Asset Portfolio</h1>
            <p className="text-muted-foreground">Manage your pledged assets and tokens</p>
          </div>
          <div className="flex space-x-3">
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/pledge')}>
              <Plus className="h-4 w-4 mr-2" />
              New Pledge
            </Button>
          </div>
        </div>

        {/* Blockchain Status Banner */}
        {!blockchainFeaturesAvailable && (
          <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Running in database-only mode. Some blockchain features may be limited.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Pledges</p>
                  <p className="text-2xl font-bold">{stats.totalPledges}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Coins className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Pledges</p>
                  <p className="text-2xl font-bold">{stats.activePledges}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Asset Value</p>
                  <p className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Wallet className="h-8 w-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Token Balance</p>
                  <p className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="pledges" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pledges">My Pledges</TabsTrigger>
            <TabsTrigger value="tokens">Token Balances</TabsTrigger>
            <TabsTrigger value="nfts">NFT Assets</TabsTrigger>
          </TabsList>

          {/* Pledges Tab */}
          <TabsContent value="pledges">
            <Card>
              <CardHeader>
                <CardTitle>Asset Pledges</CardTitle>
              </CardHeader>
              <CardContent>
                {pledges.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No pledges yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Get started by pledging your first real-world asset
                    </p>
                    <Button onClick={() => navigate('/pledge')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Pledge
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pledges.map((pledge) => (
                      <Card key={pledge.id} className="border-l-4 border-l-primary/20">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center space-x-3">
                                <h3 className="text-lg font-semibold">
                                  {pledge.asset_type.replace('_', ' ').toUpperCase()} - #{pledge.pledge_id}
                                </h3>
                                {getStatusBadge(pledge.status)}
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Appraised Value</p>
                                  <p className="font-semibold">${pledge.appraised_value.toLocaleString()}</p>
                                </div>
                                {pledge.token_amount && (
                                  <div>
                                    <p className="text-muted-foreground">Token Amount</p>
                                    <p className="font-semibold">{pledge.token_amount.toLocaleString()} {pledge.token_symbol}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-muted-foreground">Created</p>
                                  <p className="font-semibold">{new Date(pledge.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>

                              <p className="text-sm text-muted-foreground">
                                {getStatusDescription(pledge.status)}
                              </p>

                              {pledge.status === 'rejected' && pledge.rejection_reason && (
                                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Rejection Reason:
                                  </p>
                                  <p className="text-sm text-red-700 dark:text-red-300">
                                    {pledge.rejection_reason}
                                  </p>
                                </div>
                              )}

                              {pledge.status === 'pending' && (
                                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                      Review in Progress
                                    </p>
                                  </div>
                                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    Our team is reviewing your asset documentation and appraisal.
                                  </p>
                                </div>
                              )}

                              {pledge.status === 'approved' && (
                                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                                  <div className="flex items-center space-x-2">
                                    <CheckCircle className="h-4 w-4 text-blue-600" />
                                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                      Approved - Awaiting Token Minting
                                    </p>
                                  </div>
                                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                    Your pledge has been approved for {pledge.token_amount?.toLocaleString()} tokens.
                                  </p>
                                </div>
                              )}

                              {pledge.status === 'tokens_minted' && (
                                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <Coins className="h-4 w-4 text-green-600" />
                                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                          Tokens Active
                                        </p>
                                      </div>
                                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                        {pledge.token_amount?.toLocaleString()} {pledge.token_symbol} tokens are now in your wallet.
                                      </p>
                                    </div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          disabled={!blockchainFeaturesAvailable}
                                        >
                                          Redeem Asset
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Redeem Asset Pledge</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will burn your {pledge.token_amount?.toLocaleString()} {pledge.token_symbol} tokens 
                                            and return your physical asset. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleRedeemTokens(pledge)}>
                                            Redeem Asset
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </div>
                              )}
                            </div>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Pledge Details - #{pledge.pledge_id}</DialogTitle>
                                  <DialogDescription>
                                    Complete information about your asset pledge
                                  </DialogDescription>
                                </DialogHeader>
                                <PledgeDetailsModal pledge={pledge} />
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Token Balances Tab */}
          <TabsContent value="tokens">
            <Card>
              <CardHeader>
                <CardTitle>Token Balances</CardTitle>
              </CardHeader>
              <CardContent>
                {tokenBalances.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No tokens yet</h3>
                    <p className="text-muted-foreground">
                      Tokens will appear here after your pledges are approved and minted
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Asset Type</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Contract</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokenBalances.map((token, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">{token.symbol}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            {token.assetType.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="font-mono">
                            {token.balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {token.contractAddress.substring(0, 6)}...
                            {token.contractAddress.slice(-4)}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" asChild>
                              <a 
                                href={`https://sepolia.etherscan.io/token/${token.contractAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NFT Assets Tab */}
          <TabsContent value="nfts">
            <Card>
              <CardHeader>
                <CardTitle>NFT Assets</CardTitle>
              </CardHeader>
              <CardContent>
                {nftAssets.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No NFT assets yet</h3>
                    <p className="text-muted-foreground">
                      NFTs representing your pledged assets will appear here
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {nftAssets.map((nft) => (
                      <Card key={nft.tokenId} className="overflow-hidden">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">NFT #{nft.tokenId}</Badge>
                              <Badge>Pledge #{nft.pledgeId}</Badge>
                            </div>
                            
                            <div>
                              <h3 className="font-semibold capitalize">
                                {nft.assetType.replace('_', ' ')}
                              </h3>
                              <p className="text-2xl font-bold text-primary">
                                ${nft.appraisedValue.toLocaleString()}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Document Hash:</span>
                                <span className="font-mono text-xs">
                                  {nft.documentHash.substring(0, 8)}...
                                </span>
                              </div>
                            </div>

                            <Button size="sm" variant="outline" className="w-full" asChild>
                              <a 
                                href={`https://testnets.opensea.io/assets/sepolia/${nft.contractAddress}/${nft.tokenId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View on OpenSea
                                <ExternalLink className="h-4 w-4 ml-2" />
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Pledge Details Modal Component
const PledgeDetailsModal = ({ pledge }: { pledge: UserPledge }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Pledge ID</Label>
          <p className="text-lg font-bold">#{pledge.pledge_id}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Status</Label>
          <div className="mt-1">
            <Badge className="bg-blue-500 text-white">
              <CheckCircle className="h-3 w-3 mr-1" />
              {pledge.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Asset Type</Label>
          <p className="capitalize">{pledge.asset_type.replace('_', ' ')}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Token Symbol</Label>
          <p>{pledge.token_symbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Appraised Value</Label>
          <p className="text-lg font-bold">${pledge.appraised_value.toLocaleString()}</p>
        </div>
        {pledge.token_amount && (
          <div>
            <Label className="text-sm font-medium">Token Amount</Label>
            <p className="text-lg font-bold">{pledge.token_amount.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium">Description</Label>
        <p className="text-sm mt-1 p-3 bg-muted rounded">{pledge.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Appraisal Date</Label>
          <p>{new Date(pledge.appraisal_date).toLocaleDateString()}</p>
        </div>
        <div>
          <Label className="text-sm font-medium">Created</Label>
          <p>{new Date(pledge.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Document Hash</Label>
        <p className="font-mono text-sm break-all bg-muted p-2 rounded">
          {pledge.document_hash}
        </p>
      </div>

      <div>
        <Label className="text-sm font-medium">Smart Contract</Label>
        <div className="flex items-center space-x-2">
          <p className="font-mono text-sm break-all">{pledge.contract_address}</p>
          <Button size="sm" variant="outline" asChild>
            <a 
              href={`https://sepolia.etherscan.io/address/${pledge.contract_address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;