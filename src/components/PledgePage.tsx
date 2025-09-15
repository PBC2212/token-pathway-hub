import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Coins, Shield, TrendingUp, FileCheck, Clock, AlertTriangle, CheckCircle, Upload, Link, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Enhanced smart contract integration types
interface ContractConfig {
  pledgeFactoryAddress: string;
  pledgeEscrowAddress: string;
  pledgeNFTAddress: string;
  fireblocksVaultAccountId: string;
}

interface AssetTypeMapping {
  value: string;
  label: string;
  symbol: string;
  contractType: number;
}

interface PledgeResponse {
  success: boolean;
  message: string;
  pledgeId: number;
  blockchainPledgeId?: number;
  blockchainTransaction?: string;
  blockchainEnabled: boolean;
  nftTokenId?: number;
  data: any;
}

const PledgePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [contractConfig, setContractConfig] = useState<ContractConfig | null>(null);
  const [fireblocksConnected, setFireblocksConnected] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    walletAddress: '',
    assetType: '',
    appraisedValue: '',
    tokenSymbol: 'RET',
    description: '',
    appraisalDate: '',
    appraiserLicense: '',
    documentFile: null as File | null,
    documentHash: '',
  });

  // Asset types with smart contract enum mapping - matches backend exactly
  const assetTypes: AssetTypeMapping[] = [
    { value: 'real_estate', label: 'Real Estate', symbol: 'RET', contractType: 0 },
    { value: 'gold', label: 'Gold', symbol: 'GLD', contractType: 1 },
    { value: 'vehicle', label: 'Vehicle', symbol: 'VET', contractType: 2 },
    { value: 'art', label: 'Art & Collectibles', symbol: 'ART', contractType: 3 },
    { value: 'equipment', label: 'Equipment', symbol: 'EQT', contractType: 4 },
    { value: 'commodity', label: 'Commodity', symbol: 'COM', contractType: 5 }
  ];

  // Load contract configuration on mount
  useEffect(() => {
    loadContractConfig();
    checkFireblocksConnection();
  }, []);

  const loadContractConfig = async () => {
    try {
<<<<<<< HEAD
      // In production, these would come from your environment or database
      const config: ContractConfig = {
        pledgeFactoryAddress: process.env.REACT_APP_PLEDGE_FACTORY_ADDRESS || '',
        pledgeEscrowAddress: process.env.REACT_APP_PLEDGE_ESCROW_ADDRESS || '',
        pledgeNFTAddress: process.env.REACT_APP_PLEDGE_NFT_ADDRESS || '',
        fireblocksVaultAccountId: process.env.REACT_APP_FIREBLOCKS_VAULT_ID || ''
=======
      // Use Vite's import.meta.env instead of process.env
      const config: ContractConfig = {
        pledgeFactoryAddress: import.meta.env.VITE_PLEDGE_FACTORY_ADDRESS || '',
        pledgeEscrowAddress: import.meta.env.VITE_PLEDGE_ESCROW_ADDRESS || '',
        pledgeNFTAddress: import.meta.env.VITE_PLEDGE_NFT_ADDRESS || '',
        fireblocksVaultAccountId: import.meta.env.VITE_FIREBLOCKS_VAULT_ID || ''
>>>>>>> e931753 (Added Fireblocks SDK)
      };
      
      setContractConfig(config);
    } catch (error) {
      console.error('Failed to load contract config:', error);
      toast({
        title: 'Configuration Error',
        description: 'Failed to load smart contract configuration',
        variant: 'destructive'
      });
    }
  };

  const checkFireblocksConnection = async () => {
    try {
      // Check if Fireblocks is enabled - default to false for production
      const fireblocksEnabled = false;
      
      if (fireblocksEnabled) {
        // You could add an actual API call here to verify Fireblocks connection
        const { data } = await supabase.functions.invoke('check-fireblocks-status');
        setFireblocksConnected(data?.connected || false);
      } else {
        setFireblocksConnected(false);
      }
    } catch (error) {
      console.error('Fireblocks connection check failed:', error);
      setFireblocksConnected(false);
    }
  };

  const handleAssetTypeChange = (value: string) => {
    const selectedAsset = assetTypes.find(asset => asset.value === value);
    setFormData(prev => ({
      ...prev,
      assetType: value,
      tokenSymbol: selectedAsset?.symbol || 'TOK'
    }));
    
    // Clear validation error for this field
    if (validationErrors.assetType) {
      setValidationErrors(prev => ({ ...prev, assetType: '' }));
    }
  };

  const handleDocumentUpload = async (file: File) => {
    try {
      setCurrentStep('Processing document...');
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Validate file type with MIME fallback to extension
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'] as const;
      const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'] as const;
      const byMime = allowedTypes.includes(file.type as any);
      const ext = file.name.split('.').pop()?.toLowerCase();
      const byExt = !!ext && (allowedExts as readonly string[]).includes(ext);
      if (!(byMime || byExt)) {
        throw new Error('Please upload a PDF, DOC, DOCX, JPG, or PNG file');
      }

      // Calculate file hash for blockchain storage
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      setFormData(prev => ({
        ...prev,
        documentFile: file,
        documentHash: `0x${hashHex}`
      }));

      // Clear validation error
      if (validationErrors.documentHash) {
        setValidationErrors(prev => ({ ...prev, documentHash: '' }));
      }

      toast({
        title: 'Document Processed',
        description: `${file.name} uploaded successfully and hash calculated`,
      });
      
      setCurrentStep('');
    } catch (error) {
      console.error('Document upload failed:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to process document',
        variant: 'destructive'
      });
      setCurrentStep('');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.walletAddress) {
      errors.walletAddress = 'Wallet address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.walletAddress)) {
      errors.walletAddress = 'Please enter a valid Ethereum address';
    }

    if (!formData.assetType) {
      errors.assetType = 'Please select an asset type';
    }

    if (!formData.appraisedValue) {
      errors.appraisedValue = 'Appraised value is required';
    } else if (parseFloat(formData.appraisedValue) < 1000) {
      errors.appraisedValue = 'Minimum appraised value is $1,000';
    }

    if (!formData.appraisalDate) {
      errors.appraisalDate = 'Appraisal date is required';
    } else {
      const appraisalDate = new Date(formData.appraisalDate);
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      
      if (appraisalDate > today) {
        errors.appraisalDate = 'Appraisal date cannot be in the future';
      } else if (appraisalDate < oneYearAgo) {
        errors.appraisalDate = 'Appraisal must be less than 1 year old';
      }
    }

    if (!formData.description.trim()) {
      errors.description = 'Asset description is required';
    } else if (formData.description.length < 50) {
      errors.description = 'Description must be at least 50 characters';
    }

    if (!formData.documentHash) {
      errors.documentHash = 'Please upload appraisal documentation';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateProgress = (step: string, progress: number) => {
    setCurrentStep(step);
    setSubmitProgress(progress);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    setSubmitProgress(0);

    try {
      // Step 1: Check authentication
      updateProgress('Checking authentication...', 10);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please sign in to pledge assets');
      }

      // Step 2: Validate wallet with Fireblocks (optional)
      if (fireblocksConnected) {
        updateProgress('Validating wallet address...', 25);
        try {
          const { data: walletValidation } = await supabase.functions.invoke('validate-fireblocks-wallet', {
            body: { walletAddress: formData.walletAddress }
          });
          
          if (!walletValidation?.valid) {
            // Don't fail completely, just warn user
            toast({
              title: 'Wallet Warning',
              description: 'Wallet address is not managed by Fireblocks. Blockchain features may be limited.',
              variant: 'default'
            });
          }
        } catch (walletError) {
          console.warn('Wallet validation failed:', walletError);
          // Continue anyway - wallet validation is not critical
        }
      }

      // Step 3: Create pledge with enhanced data structure
      updateProgress('Creating pledge record...', 50);
      const { data: pledgeResult, error: pledgeError } = await supabase.functions.invoke('create-pledge', {
        body: {
          user_address: formData.walletAddress,
          asset_type: formData.assetType, // Send frontend string value
          appraised_value: parseFloat(formData.appraisedValue),
          token_symbol: formData.tokenSymbol,
          contract_address: contractConfig?.pledgeEscrowAddress || '',
          description: formData.description,
          document_hash: formData.documentHash,
          appraisal_date: formData.appraisalDate,
          appraiser_license: formData.appraiserLicense
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      }) as { data: PledgeResponse, error: any };

      if (pledgeError) {
        throw pledgeError;
      }

      // Step 4: Success handling with blockchain status
      updateProgress('Pledge created successfully!', 100);

      // Enhanced success message based on integration status
      const result = pledgeResult;
      let successTitle = 'Pledge Created Successfully!';
      let successDescription = '';

      if (result.blockchainEnabled && result.blockchainTransaction) {
        successTitle = 'Blockchain Pledge Created!';
        successDescription = `Pledge #${result.pledgeId} created with blockchain transaction ${result.blockchainTransaction}`;
        if (result.nftTokenId) {
          successDescription += ` and NFT #${result.nftTokenId}`;
        }
      } else if (result.blockchainEnabled && !result.blockchainTransaction) {
        successTitle = 'Pledge Created (Blockchain Pending)';
        successDescription = `Pledge #${result.pledgeId} created. Blockchain integration is pending - check back later for transaction details.`;
      } else {
        successDescription = `Pledge #${result.pledgeId} created and pending admin review. Blockchain features not enabled.`;
      }

      toast({
        title: successTitle,
        description: successDescription,
      });

      // Clear form
      setFormData({
        walletAddress: '',
        assetType: '',
        appraisedValue: '',
        tokenSymbol: 'RET',
        description: '',
        appraisalDate: '',
        appraiserLicense: '',
        documentFile: null,
        documentHash: '',
      });
      
      setValidationErrors({});

      // Navigate to dashboard after a delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('Error submitting pledge:', error);
      
      let errorMessage = 'Failed to create pledge. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Submission Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setSubmitProgress(0);
      setCurrentStep('');
    }
  };

  const getFieldError = (fieldName: string) => validationErrors[fieldName];
  const hasFieldError = (fieldName: string) => !!validationErrors[fieldName];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          {/* Enhanced Connection Status */}
          <div className="flex gap-2">
            <Badge variant={fireblocksConnected ? "default" : "secondary"}>
              {fireblocksConnected ? (
                <>
                  <Link className="h-4 w-4 mr-1" />
                  Blockchain Enabled
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-1" />
                  Database Only
                </>
              )}
            </Badge>
            {contractConfig?.pledgeEscrowAddress && (
              <Badge variant="outline">
                <Shield className="h-4 w-4 mr-1" />
                Contract Ready
              </Badge>
            )}
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <Coins className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Pledge Real-World Asset</h1>
            <p className="text-muted-foreground">
              Submit your real-world assets for tokenization. Assets require admin approval before tokens can be minted.
              {fireblocksConnected && ' Full blockchain integration is enabled with NFT minting.'}
              {!fireblocksConnected && ' Currently operating in database-only mode.'}
            </p>
          </div>

          {/* Enhanced Info Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                {fireblocksConnected ? (
                  <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
                ) : (
                  <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                )}
                <h3 className="font-semibold">
                  {fireblocksConnected ? 'Blockchain Custody' : 'Secure Database'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {fireblocksConnected 
                    ? 'Fireblocks enterprise custody with smart contracts' 
                    : 'Secure database storage with blockchain preparation'
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileCheck className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Asset Verification</h3>
                <p className="text-sm text-muted-foreground">
                  Professional appraisal required with document hash verification
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold">Token Liquidity</h3>
                <p className="text-sm text-muted-foreground">
                  {fireblocksConnected 
                    ? 'Trade fractional ownership via blockchain tokens'
                    : 'Prepare for future token liquidity'
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Contract Status */}
          {contractConfig && (
            <Card className={fireblocksConnected ? "bg-blue-50 dark:bg-blue-950" : "bg-yellow-50 dark:bg-yellow-950"}>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  {fireblocksConnected ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Smart Contract Integration Active
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-600" />
                      Smart Contract Configuration Ready
                    </>
                  )}
                </h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Escrow:</strong> {contractConfig.pledgeEscrowAddress}</p>
                  <p><strong>NFT Contract:</strong> {contractConfig.pledgeNFTAddress}</p>
                  <p><strong>Status:</strong> {fireblocksConnected ? 'Active' : 'Standby (Database Only)'}</p>
                  {contractConfig.fireblocksVaultAccountId && (
                    <p><strong>Fireblocks Vault:</strong> {contractConfig.fireblocksVaultAccountId}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Indicator */}
          {isLoading && (
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{currentStep}</span>
                    <span className="text-sm text-muted-foreground">{submitProgress}%</span>
                  </div>
                  <Progress value={submitProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pledge Form - Same as before but with enhanced preview */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Tokenization Form</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">
                    Wallet Address *
                    {fireblocksConnected && <span className="text-xs text-green-600 ml-1">(Fireblocks managed)</span>}
                    {!fireblocksConnected && <span className="text-xs text-gray-500 ml-1">(Database storage)</span>}
                  </Label>
                  <Input
                    id="walletAddress"
                    placeholder="0x..."
                    value={formData.walletAddress}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, walletAddress: e.target.value }));
                      if (hasFieldError('walletAddress')) {
                        setValidationErrors(prev => ({ ...prev, walletAddress: '' }));
                      }
                    }}
                    className={hasFieldError('walletAddress') ? 'border-red-500' : ''}
                    disabled={isLoading}
                    required
                  />
                  {hasFieldError('walletAddress') && (
                    <p className="text-sm text-red-600">{getFieldError('walletAddress')}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Wallet address where tokens will be {fireblocksConnected ? 'minted' : 'assigned'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assetType">Asset Type *</Label>
                  <Select 
                    onValueChange={handleAssetTypeChange} 
                    value={formData.assetType}
                    disabled={isLoading}
                  >
                    <SelectTrigger className={hasFieldError('assetType') ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select asset type" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetTypes.map((asset) => (
                        <SelectItem key={asset.value} value={asset.value}>
                          <div className="flex items-center justify-between w-full">
                            <span>{asset.label} ({asset.symbol})</span>
                            <Badge variant="outline" className="ml-2">
                              Contract: {asset.contractType}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasFieldError('assetType') && (
                    <p className="text-sm text-red-600">{getFieldError('assetType')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appraisedValue">Appraised Value (USD) *</Label>
                  <Input
                    id="appraisedValue"
                    type="number"
                    placeholder="100000"
                    value={formData.appraisedValue}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, appraisedValue: e.target.value }));
                      if (hasFieldError('appraisedValue')) {
                        setValidationErrors(prev => ({ ...prev, appraisedValue: '' }));
                      }
                    }}
                    className={hasFieldError('appraisedValue') ? 'border-red-500' : ''}
                    disabled={isLoading}
                    min="1000"
                    step="0.01"
                    required
                  />
                  {hasFieldError('appraisedValue') && (
                    <p className="text-sm text-red-600">{getFieldError('appraisedValue')}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Professional appraisal value (minimum $1,000 USD)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appraisalDate">Appraisal Date *</Label>
                  <Input
                    id="appraisalDate"
                    type="date"
                    value={formData.appraisalDate}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, appraisalDate: e.target.value }));
                      if (hasFieldError('appraisalDate')) {
                        setValidationErrors(prev => ({ ...prev, appraisalDate: '' }));
                      }
                    }}
                    className={hasFieldError('appraisalDate') ? 'border-red-500' : ''}
                    disabled={isLoading}
                    max={new Date().toISOString().split('T')[0]}
                    required
                  />
                  {hasFieldError('appraisalDate') && (
                    <p className="text-sm text-red-600">{getFieldError('appraisalDate')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appraiserLicense">Appraiser License Number</Label>
                  <Input
                    id="appraiserLicense"
                    placeholder="License number"
                    value={formData.appraiserLicense}
                    onChange={(e) => setFormData(prev => ({ ...prev, appraiserLicense: e.target.value }))}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentUpload">Appraisal Documentation *</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="documentUpload"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0])}
                      className={hasFieldError('documentHash') ? 'border-red-500' : ''}
                      disabled={isLoading}
                      required
                    />
                    {formData.documentFile && (
                      <Badge variant="outline" className="text-green-600">
                        <Upload className="h-3 w-3 mr-1" />
                        Uploaded
                      </Badge>
                    )}
                  </div>
                  {hasFieldError('documentHash') && (
                    <p className="text-sm text-red-600">{getFieldError('documentHash')}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Upload appraisal documents (PDF, DOC, or images, max 10MB)
                  </p>
                  {formData.documentHash && (
                    <p className="text-xs text-green-600">
                      Document hash: {formData.documentHash.substring(0, 10)}... ✓
                      {fireblocksConnected && ' (Will be stored on blockchain)'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Asset Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide a detailed description of your asset (minimum 50 characters)..."
                    value={formData.description}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, description: e.target.value }));
                      if (hasFieldError('description')) {
                        setValidationErrors(prev => ({ ...prev, description: '' }));
                      }
                    }}
                    className={hasFieldError('description') ? 'border-red-500' : ''}
                    disabled={isLoading}
                    rows={4}
                    required
                  />
                  {hasFieldError('description') && (
                    <p className="text-sm text-red-600">{getFieldError('description')}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {formData.description.length}/50 characters minimum
                  </p>
                </div>

                {/* Enhanced Token Preview */}
                {formData.appraisedValue && formData.assetType && (
                  <Card className="bg-primary/5">
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">Pledge Preview</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Asset Value:</strong> ${parseFloat(formData.appraisedValue || '0').toLocaleString()}</p>
                        <p><strong>Token Symbol:</strong> {formData.tokenSymbol}</p>
                        <p><strong>Max LTV (70%):</strong> ${(parseFloat(formData.appraisedValue || '0') * 0.7).toLocaleString()}</p>
                        <p><strong>Status:</strong> Pending admin approval</p>
                        <p><strong>Integration:</strong> {fireblocksConnected ? 'Blockchain + Database' : 'Database Only'}</p>
                        {fireblocksConnected && (
                          <>
                            <p><strong>NFT:</strong> Will be minted automatically</p>
                            <p><strong>Smart Contract:</strong> PledgeEscrow integration</p>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating Pledge...</span>
                    </div>
                  ) : (
                    <>
                      Submit Asset Pledge
                      {fireblocksConnected && (
                        <Badge variant="secondary" className="ml-2">
                          Blockchain
                        </Badge>
                      )}
                    </>
                  )}
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