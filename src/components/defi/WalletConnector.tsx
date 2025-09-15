import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface WalletStatus {
  connected: boolean;
  address: string | null;
  balance: number;
  status: 'checking' | 'connected' | 'disconnected' | 'error';
}

const WalletConnector = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [walletStatus, setWalletStatus] = useState<WalletStatus>({
    connected: false,
    address: null,
    balance: 0,
    status: 'checking'
  });
  const [loading, setLoading] = useState(false);

  const checkWalletConnection = async () => {
    if (!user) return;

    try {
      setWalletStatus(prev => ({ ...prev, status: 'checking' }));
      
      // Check Fireblocks wallet status
      const { data, error } = await supabase.functions.invoke('validate-fireblocks-wallet');
      
      if (error) {
        console.error('Error checking wallet:', error);
        setWalletStatus({
          connected: false,
          address: null,
          balance: 0,
          status: 'error'
        });
        return;
      }

      if (data?.isValid) {
        setWalletStatus({
          connected: true,
          address: data.address || user.id,
          balance: data.balance || 0,
          status: 'connected'
        });
      } else {
        setWalletStatus({
          connected: false,
          address: null,
          balance: 0,
          status: 'disconnected'
        });
      }
    } catch (error) {
      console.error('Error checking wallet status:', error);
      setWalletStatus({
        connected: false,
        address: null,
        balance: 0,
        status: 'error'
      });
    }
  };

  const connectWallet = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to connect your wallet',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      // For demo purposes, simulate wallet connection
      // In production, this would integrate with Fireblocks SDK
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setWalletStatus({
        connected: true,
        address: user.id,
        balance: 1.2345,
        status: 'connected'
      });

      toast({
        title: 'Wallet Connected',
        description: 'Successfully connected to Fireblocks wallet'
      });

    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to wallet. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkWalletConnection();
    }
  }, [user]);

  const getStatusIcon = () => {
    switch (walletStatus.status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const getStatusBadge = () => {
    switch (walletStatus.status) {
      case 'checking':
        return <Badge variant="secondary">Checking...</Badge>;
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  if (!walletStatus.connected) {
    return (
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <Button 
          onClick={connectWallet} 
          disabled={loading || walletStatus.status === 'checking'}
          variant="outline"
          size="sm"
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <div className="text-sm">
          <div className="font-medium">
            {walletStatus.address?.slice(0, 6)}...{walletStatus.address?.slice(-4)}
          </div>
          <div className="text-muted-foreground">
            {walletStatus.balance.toFixed(4)} ETH
          </div>
        </div>
      </div>
      {getStatusBadge()}
    </div>
  );
};

export default WalletConnector;