import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Coins, Home, Car, Palette, Wrench, Package } from 'lucide-react';

interface ApprovedPledge {
  id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_amount: number;
  status: string;
  created_at: string;
  approved_at: string;
}

const assetTypeIcons = {
  real_estate: Home,
  gold: Package,
  vehicle: Car,
  art: Palette,
  equipment: Wrench,
  commodity: Package
};

const assetTypeLabels = {
  real_estate: 'Real Estate',
  gold: 'Gold',
  vehicle: 'Vehicle',
  art: 'Art & Collectibles',
  equipment: 'Equipment',
  commodity: 'Commodity'
};

const MintTokensManager = () => {
  const { user } = useAuth();
  const [approvedPledges, setApprovedPledges] = useState<ApprovedPledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [mintingPledgeId, setMintingPledgeId] = useState<string | null>(null);

  const fetchApprovedPledges = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('approved_at', { ascending: false });

      if (error) {
        console.error('Error fetching approved pledges:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch approved pledges',
          variant: 'destructive'
        });
        return;
      }

      setApprovedPledges(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch approved pledges',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const mintTokens = async (pledge: ApprovedPledge) => {
    if (!user) return;

    try {
      setMintingPledgeId(pledge.id);
      
      // Get the token symbol based on asset type
      const assetTypes = [
        { value: 'real_estate', symbol: 'RET' },
        { value: 'gold', symbol: 'GLD' },
        { value: 'vehicle', symbol: 'VET' },
        { value: 'art', symbol: 'ART' },
        { value: 'equipment', symbol: 'EQT' },
        { value: 'commodity', symbol: 'COM' }
      ];
      
      const selectedAsset = assetTypes.find(asset => asset.value === pledge.asset_type);
      const tokenSymbol = selectedAsset?.symbol || 'TOK';

      // Call mint-tokens edge function
      const { data, error } = await supabase.functions.invoke('mint-tokens', {
        body: {
          address: pledge.user_address,
          amount: pledge.token_amount,
          assetType: pledge.asset_type,
          appraisedValue: pledge.appraised_value,
          contractAddress: '0x742d35Cc6634C0532925a3b8D0b5D71c1A37bb2C', // Default contract address
          tokenSymbol: tokenSymbol,
          pledgeId: pledge.id
        }
      });

      if (error) {
        console.error('Error minting tokens:', error);
        toast({
          title: 'Error',
          description: 'Failed to mint tokens. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success!',
        description: `Successfully minted ${pledge.token_amount} ${tokenSymbol} tokens. Transaction ID: ${data.transactionId}`,
      });

      // Refresh the pledges list
      await fetchApprovedPledges();

    } catch (error) {
      console.error('Error minting tokens:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setMintingPledgeId(null);
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

  useEffect(() => {
    if (user) {
      fetchApprovedPledges();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please sign in to view your approved pledges</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Mint Tokens</h2>
        </div>
        <Button onClick={fetchApprovedPledges} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Ready to Mint</h3>
        <p className="text-blue-800 text-sm">
          Your approved pledges are ready for token minting. Once minted, you can use these tokens to create liquidity pools and trade.
        </p>
      </div>

      {loading && approvedPledges.length === 0 ? (
        <div className="text-center py-8">Loading approved pledges...</div>
      ) : (
        <div className="space-y-4">
          {approvedPledges.map((pledge) => {
            const IconComponent = assetTypeIcons[pledge.asset_type as keyof typeof assetTypeIcons] || Package;
            
            return (
              <Card key={pledge.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {assetTypeLabels[pledge.asset_type as keyof typeof assetTypeLabels] || pledge.asset_type}
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Approved
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Appraised Value</p>
                      <p className="font-semibold text-lg">${pledge.appraised_value.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tokens to Mint</p>
                      <p className="font-semibold text-lg">{pledge.token_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Approved</p>
                      <p className="text-sm">{formatDate(pledge.approved_at)}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => mintTokens(pledge)}
                    disabled={mintingPledgeId === pledge.id}
                    className="w-full"
                  >
                    {mintingPledgeId === pledge.id ? (
                      'Minting Tokens...'
                    ) : (
                      `Mint ${pledge.token_amount.toLocaleString()} Tokens`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {approvedPledges.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold mb-2">No Approved Pledges</h3>
              <p>You don't have any approved pledges ready for minting.</p>
              <p className="text-sm mt-2">Submit asset pledges and wait for admin approval to mint tokens.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MintTokensManager;