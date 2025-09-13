import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Coins, Shield, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const PledgePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    walletAddress: '',
    assetType: '',
    appraisedValue: '',
    tokenSymbol: 'RET',
    contractAddress: '0x742d35Cc6634C0532925a3b8D0b5D71c1A37bb2C', // Example address
    description: ''
  });

  const assetTypes = [
    { value: 'real_estate', label: 'Real Estate', symbol: 'RET' },
    { value: 'gold', label: 'Gold', symbol: 'GLD' },
    { value: 'vehicle', label: 'Vehicle', symbol: 'VET' },
    { value: 'art', label: 'Art & Collectibles', symbol: 'ART' },
    { value: 'equipment', label: 'Equipment', symbol: 'EQT' },
    { value: 'commodity', label: 'Commodity', symbol: 'COM' }
  ];

  const handleAssetTypeChange = (value: string) => {
    const selectedAsset = assetTypes.find(asset => asset.value === value);
    setFormData(prev => ({
      ...prev,
      assetType: value,
      tokenSymbol: selectedAsset?.symbol || 'TOK'
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.walletAddress || !formData.assetType || !formData.appraisedValue) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Error',
          description: 'Please sign in to pledge assets',
          variant: 'destructive'
        });
        return;
      }

      // Calculate token amount (1:1 ratio with USD value for simplicity)
      const tokenAmount = parseFloat(formData.appraisedValue);

      // Call mint-tokens edge function
      const { data, error } = await supabase.functions.invoke('mint-tokens', {
        body: {
          address: formData.walletAddress,
          amount: tokenAmount,
          assetType: formData.assetType,
          appraisedValue: parseFloat(formData.appraisedValue),
          contractAddress: formData.contractAddress,
          tokenSymbol: formData.tokenSymbol
        }
      });

      if (error) {
        console.error('Error minting tokens:', error);
        toast({
          title: 'Error',
          description: 'Failed to initiate token minting. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success!',
        description: `Successfully initiated minting of ${tokenAmount} ${formData.tokenSymbol} tokens. Transaction ID: ${data.transactionId}`,
      });

      // Clear form
      setFormData({
        walletAddress: '',
        assetType: '',
        appraisedValue: '',
        tokenSymbol: 'RET',
        contractAddress: formData.contractAddress,
        description: ''
      });

      // Navigate to token dashboard after a delay
      setTimeout(() => {
        navigate('/token-dashboard');
      }, 2000);

    } catch (error) {
      console.error('Error submitting pledge:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Coins className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Pledge Real-World Asset</h1>
            <p className="text-muted-foreground">
              Tokenize your real-world assets and mint digital tokens representing their value
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Secure</h3>
                <p className="text-sm text-muted-foreground">Fireblocks enterprise security</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Coins className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Instant</h3>
                <p className="text-sm text-muted-foreground">Immediate token minting</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Liquid</h3>
                <p className="text-sm text-muted-foreground">Trade your asset tokens</p>
              </CardContent>
            </Card>
          </div>

          {/* Pledge Form */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Tokenization Form</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Wallet Address *</Label>
                  <Input
                    id="walletAddress"
                    placeholder="0x..."
                    value={formData.walletAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    The wallet address where tokens will be minted
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetType">Asset Type *</Label>
                  <Select onValueChange={handleAssetTypeChange} value={formData.assetType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((asset) => (
                        <SelectItem key={asset.value} value={asset.value}>
                          {asset.label} ({asset.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appraisedValue">Appraised Value (USD) *</Label>
                  <Input
                    id="appraisedValue"
                    type="number"
                    placeholder="100000"
                    value={formData.appraisedValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, appraisedValue: e.target.value }))}
                    required
                    min="1"
                    step="0.01"
                  />
                  <p className="text-sm text-muted-foreground">
                    Professional appraisal value of your asset in USD
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tokenSymbol">Token Symbol</Label>
                  <Input
                    id="tokenSymbol"
                    value={formData.tokenSymbol}
                    onChange={(e) => setFormData(prev => ({ ...prev, tokenSymbol: e.target.value }))}
                    maxLength={5}
                  />
                  <p className="text-sm text-muted-foreground">
                    Automatically set based on asset type
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contractAddress">Smart Contract Address</Label>
                  <Input
                    id="contractAddress"
                    value={formData.contractAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractAddress: e.target.value }))}
                    placeholder="0x..."
                  />
                  <p className="text-sm text-muted-foreground">
                    The deployed AssetToken contract address
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Asset Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your asset..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                {/* Token Preview */}
                {formData.appraisedValue && (
                  <Card className="bg-primary/5">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Token Preview</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Tokens to mint:</strong> {parseFloat(formData.appraisedValue || '0').toLocaleString()} {formData.tokenSymbol}</p>
                        <p><strong>Token value:</strong> $1 USD per token</p>
                        <p><strong>Total value:</strong> ${parseFloat(formData.appraisedValue || '0').toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Minting Tokens...' : 'Pledge Asset & Mint Tokens'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PledgePage;