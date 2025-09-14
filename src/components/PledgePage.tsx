import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PledgeFormData {
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash: string;
  appraisal_date: Date | undefined;
  appraiser_license: string;
}

const PledgePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<PledgeFormData>({
    user_address: '',
    asset_type: '',
    appraised_value: 0,
    token_symbol: '',
    contract_address: '',
    description: '',
    document_hash: '',
    appraisal_date: undefined,
    appraiser_license: ''
  });

  const handleInputChange = (field: keyof PledgeFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateWalletAddress = async (address: string) => {
    try {
      const { data } = await supabase.functions.invoke('validate-fireblocks-wallet', {
        body: { walletAddress: address }
      });
      return data?.valid || false;
    } catch (error) {
      console.error('Wallet validation error:', error);
      return false;
    }
  };

  const generateDocumentHash = (data: PledgeFormData) => {
    const hashString = `${data.asset_type}-${data.appraised_value}-${data.description}-${Date.now()}`;
    return btoa(hashString).substring(0, 32);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate required fields
      if (!formData.user_address || !formData.asset_type || !formData.appraised_value || !formData.description) {
        throw new Error('Please fill in all required fields');
      }

      // Validate wallet address
      const isValidWallet = await validateWalletAddress(formData.user_address);
      if (!isValidWallet) {
        throw new Error('Invalid wallet address format');
      }

      // Generate document hash if not provided
      const documentHash = formData.document_hash || generateDocumentHash(formData);

      // Prepare pledge data
      const pledgeData = {
        ...formData,
        document_hash: documentHash,
        appraisal_date: formData.appraisal_date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        token_symbol: formData.token_symbol || `${formData.asset_type.toUpperCase()}${Date.now()}`,
        contract_address: formData.contract_address || ''
      };

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Please log in to create a pledge');
      }

      const { data, error } = await supabase.functions.invoke('create-pledge', {
        body: pledgeData,
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create pledge');
      }

      toast({
        title: "Pledge Created Successfully",
        description: `Your pledge has been submitted for review. Pledge ID: ${data.pledgeId}`,
      });

      // Reset form
      setFormData({
        user_address: '',
        asset_type: '',
        appraised_value: 0,
        token_symbol: '',
        contract_address: '',
        description: '',
        document_hash: '',
        appraisal_date: undefined,
        appraiser_license: ''
      });

    } catch (error: any) {
      console.error('Pledge creation error:', error);
      toast({
        variant: "destructive",
        title: "Error Creating Pledge",
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Create Asset Pledge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user_address">Wallet Address *</Label>
                <Input
                  id="user_address"
                  type="text"
                  placeholder="0x..."
                  value={formData.user_address}
                  onChange={(e) => handleInputChange('user_address', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset_type">Asset Type *</Label>
                <Select value={formData.asset_type} onValueChange={(value) => handleInputChange('asset_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select asset type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="commodity">Commodity</SelectItem>
                    <SelectItem value="art">Art</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appraised_value">Appraised Value (USD) *</Label>
                <Input
                  id="appraised_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="10000.00"
                  value={formData.appraised_value || ''}
                  onChange={(e) => handleInputChange('appraised_value', parseFloat(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token_symbol">Token Symbol</Label>
                <Input
                  id="token_symbol"
                  type="text"
                  placeholder="AUTO (auto-generated if empty)"
                  value={formData.token_symbol}
                  onChange={(e) => handleInputChange('token_symbol', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Asset Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed description of the asset..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Appraisal Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.appraisal_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.appraisal_date ? format(formData.appraisal_date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.appraisal_date}
                      onSelect={(date) => handleInputChange('appraisal_date', date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appraiser_license">Appraiser License #</Label>
                <Input
                  id="appraiser_license"
                  type="text"
                  placeholder="License number (optional)"
                  value={formData.appraiser_license}
                  onChange={(e) => handleInputChange('appraiser_license', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_hash">Document Hash</Label>
              <Input
                id="document_hash"
                type="text"
                placeholder="Auto-generated if empty"
                value={formData.document_hash}
                onChange={(e) => handleInputChange('document_hash', e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Creating Pledge...' : 'Create Pledge'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PledgePage;