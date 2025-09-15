import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Wallet, 
  Coins, 
  Home, 
  Package, 
  Car, 
  Palette,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

interface AssetBalance {
  symbol: string;
  balance: number;
  value_usd: number;
  asset_type: string;
  change_24h: number;
}

interface WalletData {
  totalValue: number;
  totalChange: number;
  pledgedAssets: AssetBalance[];
  mintedTokens: AssetBalance[];
  lpTokens: AssetBalance[];
}

const assetIcons = {
  real_estate: Home,
  gold: Package,
  vehicle: Car,
  art: Palette,
  equipment: Package,
  commodity: Package
};

const AssetOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [walletData, setWalletData] = useState<WalletData>({
    totalValue: 0,
    totalChange: 0,
    pledgedAssets: [],
    mintedTokens: [],
    lpTokens: []
  });
  const [loading, setLoading] = useState(false);

  const fetchWalletData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch token balances
      const { data: balanceData, error: balanceError } = await supabase
        .from('token_balances')
        .select('*')
        .eq('user_address', user.id);

      if (balanceError) {
        console.error('Error fetching balances:', balanceError);
        return;
      }

      // Fetch pledges for context
      const { data: pledgeData, error: pledgeError } = await supabase
        .from('pledges')
        .select('*')
        .eq('user_address', user.id)
        .eq('status', 'approved');

      if (pledgeError) {
        console.error('Error fetching pledges:', pledgeError);
      }

      // Transform data for display
      const pledgedAssets: AssetBalance[] = (pledgeData || []).map(pledge => ({
        symbol: pledge.asset_type.toUpperCase(),
        balance: 1, // Represents the pledged asset
        value_usd: pledge.appraised_value,
        asset_type: pledge.asset_type,
        change_24h: Math.random() * 10 - 5 // Mock 24h change
      }));

      const mintedTokens: AssetBalance[] = (balanceData || []).map(token => ({
        symbol: token.token_symbol,
        balance: typeof token.balance === 'string' ? parseFloat(token.balance) : token.balance,
        value_usd: (typeof token.balance === 'string' ? parseFloat(token.balance) : token.balance) * Math.random() * 1000, // Mock USD value
        asset_type: 'token',
        change_24h: Math.random() * 10 - 5
      }));

      // Mock LP tokens
      const lpTokens: AssetBalance[] = [
        {
          symbol: 'RET-USDC LP',
          balance: 150.5,
          value_usd: 15500,
          asset_type: 'lp_token',
          change_24h: 2.3
        }
      ];

      const totalValue = [
        ...pledgedAssets,
        ...mintedTokens,
        ...lpTokens
      ].reduce((sum, asset) => sum + asset.value_usd, 0);

      setWalletData({
        totalValue,
        totalChange: 5.2, // Mock total change
        pledgedAssets,
        mintedTokens,
        lpTokens
      });

    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const renderAssetList = (assets: AssetBalance[], title: string, emptyMessage: string) => (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-muted-foreground">{title}</h4>
      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset, index) => {
            const IconComponent = assetIcons[asset.asset_type as keyof typeof assetIcons] || Coins;
            return (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <IconComponent className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-medium">{asset.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      {asset.balance.toFixed(4)} tokens
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">${asset.value_usd.toLocaleString()}</div>
                  <div className={`text-sm ${asset.change_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {asset.change_24h >= 0 ? '+' : ''}{asset.change_24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Overview
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchWalletData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Portfolio Value */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Portfolio Value</span>
            <Badge variant={walletData.totalChange >= 0 ? "default" : "destructive"}>
              {walletData.totalChange >= 0 ? '+' : ''}{walletData.totalChange.toFixed(2)}%
            </Badge>
          </div>
          <div className="text-3xl font-bold">
            ${walletData.totalValue.toLocaleString()}
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground">Asset Allocation</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Pledged Assets</span>
              <span>{walletData.pledgedAssets.length > 0 ? '45%' : '0%'}</span>
            </div>
            <Progress value={walletData.pledgedAssets.length > 0 ? 45 : 0} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span>Minted Tokens</span>
              <span>{walletData.mintedTokens.length > 0 ? '35%' : '0%'}</span>
            </div>
            <Progress value={walletData.mintedTokens.length > 0 ? 35 : 0} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span>LP Tokens</span>
              <span>{walletData.lpTokens.length > 0 ? '20%' : '0%'}</span>
            </div>
            <Progress value={walletData.lpTokens.length > 0 ? 20 : 0} className="h-2" />
          </div>
        </div>

        {/* Asset Lists */}
        {renderAssetList(
          walletData.pledgedAssets,
          'Pledged Assets',
          'No pledged assets found'
        )}

        {renderAssetList(
          walletData.mintedTokens,
          'Minted Tokens',
          'No minted tokens found'
        )}

        {renderAssetList(
          walletData.lpTokens,
          'LP Tokens',
          'No LP tokens found'
        )}

        {/* Quick Actions */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="w-full">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trade
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              <Coins className="h-4 w-4 mr-2" />
              Mint More
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetOverview;