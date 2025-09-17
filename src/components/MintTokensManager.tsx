import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Coins, RefreshCw } from 'lucide-react';

interface ApprovedPledge {
  id: string;
  user_id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_amount: number;
  token_symbol: string;
  status: string;
  created_at: string;
  approved_at: string;
  token_minted?: boolean;
  blockchain_tx_hash?: string;
  pledge_id?: number;
  ltv_ratio?: string;
}

const MintTokensManager = () => {
  const { user } = useAuth();
  const [approvedPledges, setApprovedPledges] = useState<ApprovedPledge[]>([]);
  const [loading, setLoading] = useState(false);

  // Test function to verify component is loaded
  useEffect(() => {
    console.log('🔥 SIMPLE TEST VERSION LOADED - If you see this, the component updated!');
    console.log('User:', user?.id);
  }, [user]);

  const fetchApprovedPledges = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Fetching pledges...');
      
      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .eq('token_minted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pledges:', error);
        return;
      }

      console.log('Fetched pledges:', data);
      setApprovedPledges(data || []);
      
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testEdgeFunction = async () => {
    console.log('🧪 TESTING EDGE FUNCTION DIRECTLY');
    
    if (!user) {
      console.log('❌ No user logged in');
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('❌ No session found');
        return;
      }

      console.log('✅ Session found:', session.session.access_token.substring(0, 20) + '...');

      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('🌐 Supabase URL:', supabaseUrl);
      console.log('🔑 Supabase Key:', supabaseKey?.substring(0, 20) + '...');

      const testUrl = `${supabaseUrl}/functions/v1/mint-tokens`;
      console.log('📡 Making test request to:', testUrl);

      const testPayload = {
        test: true,
        pledgeId: 'test-123',
        address: '0x1234567890123456789012345678901234567890',
        amount: 1000,
        assetType: 'test',
        tokenSymbol: 'TEST'
      };

      console.log('📤 Sending payload:', testPayload);

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(testPayload)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response statusText:', response.statusText);
      console.log('📡 Response headers:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }

      const responseText = await response.text();
      console.log('📦 Raw response:', responseText);

      try {
        const responseJson = JSON.parse(responseText);
        console.log('📦 Parsed response:', responseJson);
        
        toast({
          title: 'Test Response',
          description: `Status: ${response.status}, Response: ${responseText.substring(0, 100)}`,
          variant: response.ok ? 'default' : 'destructive'
        });
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        toast({
          title: 'Test Response (Non-JSON)',
          description: `Status: ${response.status}, Text: ${responseText.substring(0, 100)}`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('💥 Test error:', error);
      toast({
        title: 'Test Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const mintStablecoins = async (pledge: ApprovedPledge) => {
    console.log('🚀 MINT CLICKED - Pledge ID:', pledge.id);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        console.log('❌ No session for minting');
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const mintUrl = `${supabaseUrl}/functions/v1/mint-tokens`;
      console.log('🌐 Minting to:', mintUrl);

      const mintPayload = {
        pledgeId: pledge.id,
        address: pledge.user_address,
        amount: Math.floor(pledge.appraised_value * 0.8), // 80% LTV
        assetType: pledge.asset_type,
        tokenSymbol: pledge.token_symbol || 'TEST',
        appraisedValue: pledge.appraised_value
      };

      console.log('📤 Mint payload:', mintPayload);

      const response = await fetch(mintUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify(mintPayload)
      });

      console.log('📡 Mint response status:', response.status);
      
      const responseText = await response.text();
      console.log('📦 Mint response:', responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        toast({
          title: 'SUCCESS!',
          description: `Minted tokens: ${data.message}`,
        });
        await fetchApprovedPledges(); // Refresh
      } else {
        const errorData = JSON.parse(responseText);
        console.error('❌ Mint failed:', errorData);
        toast({
          title: 'Mint Failed',
          description: `${errorData.error}: ${errorData.details || ''}`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('💥 Mint error:', error);
      toast({
        title: 'Unexpected Error',
        description: error.message,
        variant: 'destructive'
      });
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
          <Coins className="h-6 w-6" />
          <h2 className="text-2xl font-bold">SIMPLE TEST VERSION - Mint Tokens</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={testEdgeFunction} variant="secondary">
            Test Edge Function
          </Button>
          <Button onClick={fetchApprovedPledges} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">SIMPLE TEST VERSION</h3>
        <p className="text-yellow-800 text-sm">
          This version has detailed console logging. Open browser console (F12) to see all debug info.
          Use "Test Edge Function" button to test the connection first.
        </p>
      </div>

      <div className="space-y-4">
        {approvedPledges.map((pledge) => (
          <Card key={pledge.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{pledge.asset_type} (${pledge.appraised_value.toLocaleString()})</span>
                <Badge>Approved</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => mintStablecoins(pledge)}
                className="w-full"
              >
                Mint Tokens for Pledge {pledge.id.substring(0, 8)}...
              </Button>
            </CardContent>
          </Card>
        ))}

        {approvedPledges.length === 0 && !loading && (
          <div className="text-center py-8">
            <p>No approved pledges found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MintTokensManager;
