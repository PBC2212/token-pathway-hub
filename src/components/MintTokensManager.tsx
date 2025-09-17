import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Coins, RefreshCw, Loader2 } from 'lucide-react';

interface PledgeData {
  id: string;
  user_id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string | null;
  status: string;
  token_minted: boolean;
  created_at: string;
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
      
      // Use manual query to avoid TypeScript issues
      const response = await fetch(`https://fdbcuegidxvdanpoqztv.supabase.co/rest/v1/pledges?user_id=eq.${user.id}&status=eq.approved&token_minted=eq.false&order=created_at.desc`, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYmN1ZWdpZHh2ZGFucG9xenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjkwNjgsImV4cCI6MjA3MzEwNTA2OH0.SWYPRoeCcQdPLhmsujoN4dWouSWUwD3PtFMo4dzmNMU',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pledges');
      }

      const data = await response.json();
      setApprovedPledges(data as PledgeData[]);
      
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
      
      const { data, error } = await supabase.functions.invoke('mint-tokens', {
        body: {
          pledgeId: pledge.id,
          address: pledge.user_address,
          amount: Math.floor(pledge.appraised_value * 0.8), // 80% LTV
          assetType: pledge.asset_type,
          tokenSymbol: pledge.token_symbol || 'RWA',
          appraisedValue: pledge.appraised_value
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
          <h2 className="text-2xl font-bold">Mint Tokens</h2>
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
                  <span className="font-medium">Asset Type:</span> {pledge.asset_type}
                </div>
                <div>
                  <span className="font-medium">Token Symbol:</span> {pledge.token_symbol || 'RWA'}
                </div>
                <div>
                  <span className="font-medium">LTV Ratio:</span> 80%
                </div>
                <div>
                  <span className="font-medium">Mint Amount:</span> 
                  ${Math.floor((pledge.appraised_value || 0) * 0.8).toLocaleString()}
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
                    Minting Tokens...
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4 mr-2" />
                    Mint Tokens
                  </>
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