import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Coins, RefreshCw, Loader2, Building, Gem, FileText, Wrench, Package, Archive } from 'lucide-react';

// Category icon mapping for multi-token system
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'RealEstate': return Building;
    case 'Commodities': return Gem;
    case 'Bonds': return FileText;
    case 'Equipment': return Wrench;
    case 'Inventory': return Package;
    case 'Other': return Archive;
    default: return Coins;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'RealEstate': return 'bg-blue-100 text-blue-800';
    case 'Commodities': return 'bg-yellow-100 text-yellow-800';
    case 'Bonds': return 'bg-green-100 text-green-800';
    case 'Equipment': return 'bg-purple-100 text-purple-800';
    case 'Inventory': return 'bg-orange-100 text-orange-800';
    case 'Other': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryTokenName = (category: string) => {
  switch (category) {
    case 'RealEstate': return 'Real Estate USD';
    case 'Commodities': return 'Commodities USD';
    case 'Bonds': return 'Bonds USD';
    case 'Equipment': return 'Equipment USD';
    case 'Inventory': return 'Inventory USD';
    case 'Other': return 'Other Assets USD';
    default: return 'Other Assets USD';
  }
};

interface PledgeData {
  id: string;
  user_id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number; // Normalized to number
  token_symbol: string | null;
  status: string;
  token_minted: boolean;
  created_at: string;
  // Multi-token fields
  rwa_category?: string;
  category_token_symbol?: string;
  ltv_ratio?: number; // Normalized to number
  is_redeemable?: boolean;
  token_amount?: number; // Normalized to number
}

const MintTokensManager = () => {
  const { user } = useAuth();
  const [approvedPledges, setApprovedPledges] = useState<PledgeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState<string | null>(null);

  const fetchApprovedPledges = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // SECURITY FIX: Use secure edge function instead of direct database query
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data: pledgeResponse, error } = await supabase.functions.invoke('get-pledges', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw new Error(`Failed to fetch pledges: ${error.message}`);
      }

      // Filter for approved pledges that haven't been minted yet
      const filteredPledges = (pledgeResponse?.pledges || []).filter((pledge: any) => 
        pledge.status === 'approved' && 
        pledge.token_minted === false
      );

      // Transform data to match PledgeData interface and normalize numeric fields
      const transformedData = filteredPledges?.map((pledge: any) => ({
        ...pledge,
        token_minted: pledge.token_minted ?? false,
        rwa_category: pledge.rwa_category || 'Other',
        category_token_symbol: pledge.category_token_symbol || pledge.token_symbol,
        ltv_ratio: parseInt(pledge.ltv_ratio?.toString() || '8000'),
        is_redeemable: pledge.is_redeemable ?? true,
        // Convert numeric strings to numbers for calculations
        appraised_value: parseFloat(pledge.appraised_value?.toString() || '0'),
        token_amount: parseFloat(pledge.token_amount?.toString() || '0')
      })) as PledgeData[] || [];
      
      setApprovedPledges(transformedData);
      
    } catch (error) {
      console.error('Error fetching pledges:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch approved pledges',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const mintStablecoins = async (pledge: PledgeData) => {
    try {
      setMinting(pledge.id);
      
      // Calculate amount using database LTV ratio for security
      const ltvRatio = pledge.ltv_ratio || 8000; // Default 80% LTV in basis points
      const calculatedAmount = Math.floor(pledge.appraised_value * (ltvRatio / 10000));
      const categoryToken = pledge.category_token_symbol || pledge.token_symbol || 'OUSD';
      
      const { data, error } = await supabase.functions.invoke('mint-tokens', {
        body: {
          pledgeId: pledge.id,
          address: pledge.user_address,
          amount: calculatedAmount,
          assetType: pledge.asset_type,
          tokenSymbol: categoryToken,
          appraisedValue: pledge.appraised_value,
          category: pledge.rwa_category || 'Other'
        }
      });

      if (error) {
        console.error('Mint error:', error);
        toast({
          title: 'Minting Failed',
          description: error.message || 'Failed to mint tokens',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success!',
        description: `Tokens minted successfully: ${data?.message || 'Transaction completed'}`,
      });
      
      // Refresh pledges
      await fetchApprovedPledges();
      
    } catch (error) {
      console.error('Unexpected mint error:', error);
      toast({
        title: 'Unexpected Error',
        description: 'An error occurred during minting',
        variant: 'destructive'
      });
    } finally {
      setMinting(null);
    }
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
          <Coins className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Mint Category Tokens</h2>
          <Badge variant="outline" className="text-xs">Multi-Token System</Badge>
        </div>
        <Button onClick={fetchApprovedPledges} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="space-y-4">
        {approvedPledges.map((pledge) => (
          <Card key={pledge.id} className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-lg">{pledge.asset_type}</span>
                  <span className="text-sm text-muted-foreground">
                    Appraised Value: ${pledge.appraised_value?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Approved
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Asset Category:</span> 
                  <div className="flex items-center gap-2 mt-1">
                    {(() => {
                      const category = pledge.rwa_category || 'Other';
                      const CategoryIcon = getCategoryIcon(category);
                      return (
                        <>
                          <Badge className={getCategoryColor(category) + ' text-xs'}>
                            <CategoryIcon className="h-3 w-3 mr-1" />
                            {category.replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Token Type:</span> 
                  <div className="font-mono text-blue-600 mt-1">
                    {pledge.category_token_symbol || pledge.token_symbol || 'OUSD'}
                  </div>
                </div>
                <div>
                  <span className="font-medium">LTV Ratio:</span> 
                  <div className="text-green-600 mt-1">
                    {((pledge.ltv_ratio || 8000) / 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <span className="font-medium">Mintable Amount:</span> 
                  <div className="text-green-600 font-bold mt-1">
                    ${Math.floor((pledge.appraised_value || 0) * ((pledge.ltv_ratio || 8000) / 10000)).toLocaleString()} 
                    <span className="ml-1 font-mono text-sm">{pledge.category_token_symbol || pledge.token_symbol || 'OUSD'}</span>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => mintStablecoins(pledge)}
                disabled={minting === pledge.id}
                className="w-full"
                size="lg"
              >
                {minting === pledge.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Minting {pledge.category_token_symbol || pledge.token_symbol || 'OUSD'}...
                  </>
                ) : (
                  (() => {
                    const category = pledge.rwa_category || 'Other';
                    const CategoryIcon = getCategoryIcon(category);
                    const tokenSymbol = pledge.category_token_symbol || pledge.token_symbol || 'OUSD';
                    return (
                      <>
                        <CategoryIcon className="h-4 w-4 mr-2" />
                        Mint {tokenSymbol} Tokens
                      </>
                    );
                  })()
                )}
              </Button>
            </CardContent>
          </Card>
        ))}

        {approvedPledges.length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-8">
              <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No approved pledges available for minting</p>
              <p className="text-sm text-muted-foreground mt-2">
                Complete your pledge approval process to mint tokens
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MintTokensManager;