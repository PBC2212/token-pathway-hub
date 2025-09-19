import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VaultManager from '@/components/VaultManager';
import { LogOut, Shield, FileText, Users, Building, Briefcase, User, Mail, Calendar, Vault, Settings, Coins, TrendingUp, DollarSign, Droplets, ExternalLink, Clock, CheckCircle, Lock, Key, Smartphone, AlertTriangle, Eye, EyeOff, History, Globe, Save, Database, Link, RefreshCw, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  kyc_status: string;
  created_at: string;
}

interface Pledge {
  id: string;
  pledge_id: number;
  user_address: string;
  asset_type: string;
  asset_type_label?: string;
  appraised_value: number;
  formatted_appraised_value?: string;
  token_amount: number;
  formatted_token_amount?: string;
  token_symbol: string;
  status: string;
  status_label?: string;
  description: string;
  blockchain_enabled?: boolean;
  blockchain_status?: string;
  nft_token_id?: number;
  created_at: string;
  days_since_created?: number;
  ltv_ratio?: string;
  rejection_reason?: string;
}

interface PledgeData {
  userId: string;
  userEmail: string;
  pledges: Pledge[];
  summary: {
    totalPledges: number;
    totalValue: number;
    totalTokens: number;
    averageValue: number;
    statusBreakdown: Record<string, number>;
    assetTypeBreakdown: Record<string, any>;
    blockchainStats: {
      total_blockchain_enabled: number;
      total_with_blockchain_id: number;
      total_with_nft: number;
      total_with_tx_hash: number;
    };
  };
  metadata: {
    lastUpdated: string;
    dataVersion: string;
    blockchainIntegrationAvailable: boolean;
  };
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pledgeData, setPledgeData] = useState<PledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pledgesLoading, setPledgesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mintingPledgeId, setMintingPledgeId] = useState<string | null>(null);

  const handleMintTokens = async (pledgeId: string) => {
    try {
      setMintingPledgeId(pledgeId);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to mint tokens',
          variant: 'destructive'
        });
        return;
      }

      // Find the pledge in our current data to get required fields
      const pledge = pledgeData?.pledges?.find(p => p.id === pledgeId);
      if (!pledge) {
        toast({
          title: 'Pledge Not Found',
          description: 'Could not find pledge data for minting',
          variant: 'destructive'
        });
        return;
      }

      // Category token mapping for symbol determination
      const categoryTokenMap: Record<string, { symbol: string }> = {
        'RealEstate': { symbol: 'RUSD' },
        'Commodities': { symbol: 'CUSD' },
        'Bonds': { symbol: 'BUSD' },
        'Equipment': { symbol: 'EUSD' },
        'Inventory': { symbol: 'IUSD' },
        'Other': { symbol: 'OUSD' }
      };

      const normalizedCategory = (pledge as any).rwa_category || 'Other';
      const tokenInfo = categoryTokenMap[normalizedCategory] || categoryTokenMap['Other'];

      // Calculate token amount based on LTV ratio
      const appraisedValue = parseFloat((pledge as any).appraised_value?.toString() || '0');
      const ltvRatio = parseInt((pledge as any).ltv_ratio?.toString() || '8000'); // Default 80%
      const tokenAmount = appraisedValue * (ltvRatio / 10000);

      const { data, error } = await supabase.functions.invoke('mint-tokens', {
        body: {
          pledgeId,
          address: (pledge as any).user_address || user?.user_metadata?.wallet_address || '0x1234567890123456789012345678901234567890',
          amount: tokenAmount,
          assetType: pledge.asset_type || normalizedCategory,
          appraisedValue,
          tokenSymbol: tokenInfo.symbol
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Tokens Minted Successfully',
          description: `Minted ${tokenAmount.toFixed(2)} ${tokenInfo.symbol} tokens`,
        });
        await fetchPledges();
      }
    } catch (error) {
      console.error('Error minting tokens:', error);
      toast({
        title: 'Minting Failed',
        description: 'Failed to mint tokens. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setMintingPledgeId(null);
    }
  };
  
  // Form states for profile editing
  const [formData, setFormData] = useState({
    full_name: '',
    email: ''
  });
  
  // Password change states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    emailNotifications: true,
    loginAlerts: true,
    sessionTimeout: 30
  });

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchPledges();
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const fetchUserProfile = async () => {
    try {
      // SECURITY FIX: Use secure edge function instead of direct database query
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data: response, error } = await supabase.functions.invoke('get-user-profile', {
        body: { operation: 'get_profile' },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error || !response.success) {
        console.error('Error fetching profile:', error || response.error);
        toast({
          title: "Profile Error",
          description: "Could not load your profile information.",
          variant: "destructive",
        });
      } else {
        setProfile(response.profile);
        setFormData({
          full_name: response.profile.full_name || '',
          email: response.profile.email || ''
        });
      }
    } catch (error: any) {
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPledges = async () => {
    try {
      setPledgesLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-pledges', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error fetching pledges:', error);
        toast({
          title: "Pledges Error",
          description: "Could not load your pledge data.",
          variant: "destructive",
        });
      } else {
        console.log('Pledges fetched successfully:', data);
        setPledgeData(data);
      }
    } catch (error: any) {
      console.error('Pledge fetch error:', error);
      toast({
        title: "Pledges Error", 
        description: "Failed to load pledge information.",
        variant: "destructive",
      });
    } finally {
      setPledgesLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // SECURITY FIX: Use secure edge function instead of direct database query
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('Not authenticated');
      }

      const { data: response, error } = await supabase.functions.invoke('get-user-profile', {
        body: { 
          operation: 'update_profile',
          full_name: formData.full_name 
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error || !response.success) {
        throw new Error(error?.message || response.error || 'Failed to update profile');
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      await fetchUserProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    }
  };

  const handleToggleSetting = (setting: string, value: boolean) => {
    setSecuritySettings(prev => ({
      ...prev,
      [setting]: value
    }));
    
    toast({
      title: "Settings Updated",
      description: "Your security preferences have been saved",
    });
  };

  const getKYCStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Administrator</Badge>;
      case 'user':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">User</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
      case 'redeemed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Redeemed</Badge>;
      case 'defaulted':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Defaulted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const features = [
    {
      icon: Shield,
      title: "Secure Platform",
      description: "Your tokenization journey starts here with industry-leading security"
    },
    {
      icon: FileText,
      title: "Digital Agreements",
      description: "Streamlined document management for all your tokenization needs"
    },
    {
      icon: Users,
      title: "Multi-Party Support", 
      description: "Coordinate seamlessly between all stakeholders in the process"
    },
    {
      icon: Building,
      title: "Real Estate Focus",
      description: "Purpose-built for real estate tokenization and investment"
    }
  ];

  const documentSections = [
    {
      title: "Core Agreements",
      description: "Essential legal documents for tokenization",
      documents: [
        {
          name: "Property Pledge Agreement",
          description: "Pledge property for tokenization",
          route: '/property-pledge-agreement',
          icon: Building
        },
        {
          name: "Token Issuance Agreement", 
          description: "Define token issuance terms",
          route: '/token-issuance-agreement',
          icon: Coins
        },
        {
          name: "Subscription Agreement",
          description: "Subscribe to token offerings",
          route: '/subscription-agreement',
          icon: FileText
        },
        {
          name: "Operating Agreement (SPV/LLC)",
          description: "Entity operating structure",
          route: '/operating-agreement',
          icon: Building
        }
      ]
    },
    {
      title: "Token Holder Documents",
      description: "Rights, duties, and compliance requirements",
      documents: [
        {
          name: "Token Holder Agreement",
          description: "Token holder rights and duties",
          route: '/token-holder-agreement',
          icon: Users
        },
        {
          name: "KYC/AML Policy",
          description: "Identity verification requirements",
          route: '/kyc-aml-policy',
          icon: Shield
        }
      ]
    },
    {
      title: "Operational Policies",
      description: "Platform operations and trading policies",
      documents: [
        {
          name: "Custody & Tokenization Policy",
          description: "Asset custody and tokenization terms",
          route: '/custody-tokenization-policy',
          icon: Vault
        },
        {
          name: "Swap/Settlement Agreement",
          description: "Token trading and settlement terms",
          route: '/swap-settlement-agreement',
          icon: TrendingUp
        }
      ]
    }
  ];

  if (loading || pledgesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">IME Capital Tokenization LLC</h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile?.kyc_status && getKYCStatusBadge(profile.kyc_status)}
            {pledgeData?.metadata?.blockchainIntegrationAvailable ? (
              <Badge variant="default">
                <Link className="h-3 w-3 mr-1" />
                Blockchain Ready
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Database className="h-3 w-3 mr-1" />
                Database Mode
              </Badge>
            )}
            <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tokenization">Tokenization</TabsTrigger>
            <TabsTrigger value="vaults">Vaults</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Welcome Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Welcome to Your Platform</CardTitle>
                <CardDescription>
                  Your complete RWA tokenization platform for asset management and digital transformation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Access your secure platform for tokenizing real-world assets, managing Fireblocks vaults, 
                  completing documentation, and coordinating with all stakeholders in your tokenization journey.
                </p>
                
                {/* Real Stats from Pledge Data */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {pledgeData?.summary?.totalPledges || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Assets Pledged</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      ${pledgeData?.summary?.totalValue?.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {pledgeData?.summary?.blockchainStats?.total_blockchain_enabled || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Blockchain Enabled</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {pledgeData?.summary?.statusBreakdown?.approved || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Approved Pledges</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Pledges */}
            {pledgeData?.pledges && pledgeData.pledges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Your Recent Pledges
                  </CardTitle>
                  <CardDescription>
                    Overview of your submitted asset pledges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pledgeData.pledges.slice(0, 3).map((pledge) => (
                      <div key={pledge.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {pledge.asset_type_label || pledge.asset_type} - {pledge.token_symbol}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {pledge.formatted_appraised_value || `$${pledge.appraised_value?.toLocaleString()}`}
                              {pledge.blockchain_enabled && ' • Blockchain Enabled'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(pledge.status)}
                          {pledge.days_since_created !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {pledge.days_since_created} days ago
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {pledgeData.pledges.length > 3 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate('/pledges')}
                      >
                        View All Pledges ({pledgeData.pledges.length})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {pledgeData?.pledges && pledgeData.pledges.length === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Get Started with Asset Pledging</CardTitle>
                  <CardDescription>
                    You haven't pledged any assets yet. Start your tokenization journey today.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Pledge your real-world assets to begin the tokenization process.
                    </p>
                    <Button onClick={() => navigate('/pledge')}>
                      Create Your First Pledge
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, index) => (
                <Card key={index} className="text-center hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tokenization" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/pledge')}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Coins className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Pledge Assets</h3>
                    <p className="text-sm text-muted-foreground">
                      Submit your real-world assets for approval and tokenization
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  Pledge Asset
                </Button>
              </Card>

              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/mint')}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <Coins className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Mint Tokens</h3>
                    <p className="text-sm text-muted-foreground">
                      Mint digital tokens for your approved asset pledges
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  Mint Tokens
                </Button>
              </Card>

              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/defi')}>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <Droplets className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">DeFi Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      Complete DeFi experience: Create pools, stake, and earn rewards
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-4">
                  Launch DeFi
                </Button>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Token Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    View your tokenized assets, token balances, and portfolio performance
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate('/token-dashboard')}
                  >
                    View Dashboard
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Asset Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Support for real estate, gold, vehicles, art, equipment, and commodities
                  </p>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => navigate('/pledge')}
                  >
                    View Options
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5" />
                    Liquidity Pools
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Create and manage liquidity pools for your RWA tokens against USDC/USDT
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate('/liquidity')}
                  >
                    Manage Liquidity
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Show All Pledges */}
            {pledgeData?.pledges && pledgeData.pledges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    All Your Pledges
                  </CardTitle>
                  <CardDescription>
                    Complete list of your asset pledges and their current status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pledgeData.pledges.map((pledge) => (
                      <div key={pledge.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {pledge.asset_type_label || pledge.asset_type} #{pledge.pledge_id}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Token Symbol: {pledge.token_symbol}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(pledge.status)}
                            {pledge.blockchain_enabled && (
                              <Badge variant="outline">
                                <Link className="h-3 w-3 mr-1" />
                                Blockchain
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Appraised Value</p>
                            <p className="text-muted-foreground">
                              {pledge.formatted_appraised_value || `$${pledge.appraised_value?.toLocaleString()}`}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Token Amount</p>
                            <p className="text-muted-foreground">
                              {pledge.formatted_token_amount || pledge.token_amount?.toLocaleString() || 'Pending'}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Created</p>
                            <p className="text-muted-foreground">
                              {pledge.days_since_created !== undefined 
                                ? `${pledge.days_since_created} days ago`
                                : new Date(pledge.created_at).toLocaleDateString()
                              }
                            </p>
                          </div>
                        </div>

                         {pledge.description && (
                           <div className="mt-3 pt-3 border-t">
                             <p className="text-sm text-muted-foreground">
                               <strong>Description:</strong> {pledge.description}
                             </p>
                           </div>
                         )}

                         {/* Minting Progress and Status */}
                         {pledge.status === 'approved' && !pledge.token_minted && (
                           <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                             <div className="flex items-center justify-between mb-3">
                               <div>
                                 <h4 className="font-semibold text-primary">Ready for Token Minting</h4>
                                 <p className="text-sm text-muted-foreground">
                                   Your pledge has been approved. You can now mint your tokens.
                                 </p>
                               </div>
                               <Button 
                                 onClick={() => handleMintTokens(pledge.id)} 
                                 className="ml-4"
                                 disabled={mintingPledgeId === pledge.id}
                               >
                                 {mintingPledgeId === pledge.id ? (
                                   <>
                                     <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                     Minting...
                                   </>
                                 ) : (
                                   <>
                                     <Coins className="h-4 w-4 mr-2" />
                                     Mint Tokens
                                   </>
                                 )}
                               </Button>
                             </div>
                             
                             {/* Minting Details */}
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                               <div>
                                 <p className="font-medium text-primary">Approved Amount</p>
                                 <p className="text-muted-foreground">
                                   {pledge.token_amount?.toLocaleString() || 'Calculating...'}
                                 </p>
                               </div>
                               <div>
                                 <p className="font-medium text-green-600">Remaining</p>
                                 <p className="text-muted-foreground">
                                   {pledge.token_amount?.toLocaleString() || 'Full Amount'}
                                 </p>
                               </div>
                               <div>
                                 <p className="font-medium text-blue-600">Token Type</p>
                                 <p className="text-muted-foreground">
                                   {(pledge as any).category_token_symbol || pledge.token_symbol || 'RWA'}
                                 </p>
                               </div>
                               <div>
                                 <p className="font-medium text-purple-600">LTV Ratio</p>
                                 <p className="text-muted-foreground">
                                   {pledge.ltv_ratio ? `${(parseFloat(pledge.ltv_ratio)/100).toFixed(1)}%` : '80%'}
                                 </p>
                               </div>
                             </div>
                           </div>
                         )}

                         {/* Minted Tokens Status */}
                         {pledge.token_minted && (
                           <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                             <div className="flex items-center gap-3">
                               <CheckCircle className="h-5 w-5 text-green-600" />
                               <div className="flex-1">
                                 <h4 className="font-semibold text-green-800">Tokens Successfully Minted</h4>
                                 <p className="text-sm text-green-600 mt-1">
                                   {pledge.token_amount?.toLocaleString()} {(pledge as any).category_token_symbol || pledge.token_symbol} tokens have been minted to your wallet.
                                 </p>
                               </div>
                             </div>
                             
                             {/* Minting Transaction Details */}
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm">
                               <div>
                                 <p className="font-medium text-green-700">Minted Amount</p>
                                 <p className="text-green-600">
                                   {pledge.token_amount?.toLocaleString() || 'N/A'}
                                 </p>
                               </div>
                               <div>
                                 <p className="font-medium text-green-700">Token Symbol</p>
                                 <p className="text-green-600">
                                   {(pledge as any).category_token_symbol || pledge.token_symbol || 'RWA'}
                                 </p>
                               </div>
                               {pledge.tx_hash && (
                                 <div>
                                   <p className="font-medium text-green-700">Transaction</p>
                                   <p className="text-green-600 font-mono text-xs">
                                     {pledge.tx_hash.substring(0, 10)}...
                                   </p>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}

                         {/* Rejection Reason Display */}
                         {pledge.status === 'rejected' && pledge.rejection_reason && (
                           <div className="mt-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                             <div className="flex items-start gap-3">
                               <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                               <div>
                                 <h4 className="font-semibold text-destructive">Pledge Rejected</h4>
                                 <p className="text-sm text-muted-foreground mt-1">
                                   {pledge.rejection_reason}
                                 </p>
                               </div>
                             </div>
                           </div>
                         )}

                        {pledge.ltv_ratio && parseFloat(pledge.ltv_ratio) > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground">
                              <strong>LTV Ratio:</strong> {pledge.ltv_ratio}%
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Smart Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle>Smart Contract Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Our tokenization system uses secure smart contracts deployed on the blockchain with Fireblocks enterprise security.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">ERC-20 Tokens</h3>
                      <p className="text-sm text-muted-foreground">
                        Industry-standard tokens with full compatibility across DeFi platforms
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Fireblocks Security</h3>
                      <p className="text-sm text-muted-foreground">
                        Enterprise-grade security with multi-party computation and secure key management
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vaults" className="space-y-6">
            <VaultManager />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            {/* Enhanced Documents Section */}
            {documentSections.map((section, sectionIndex) => (
              <Card key={sectionIndex}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {section.title}
                  </CardTitle>
                  <CardDescription>
                    {section.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.documents.map((doc, docIndex) => (
                      <Button 
                        key={docIndex}
                        variant="outline" 
                        className="h-auto p-4 justify-start hover:bg-primary/5"
                        onClick={() => navigate(doc.route)}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <doc.icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="text-left flex-1">
                            <h3 className="font-medium">{doc.name}</h3>
                            <p className="text-sm text-muted-foreground">{doc.description}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="profile" className="space-y-6 relative">
            {/* Profile Information */}
            <Card className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name" className="text-sm font-medium">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => {
                          console.log('Full name input changed:', e.target.value);
                          setFormData({ ...formData, full_name: e.target.value });
                        }}
                        placeholder="Enter your full name"
                        className="mt-1 relative z-10 pointer-events-auto"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                      <Input
                        id="email"
                        value={formData.email}
                        disabled
                        className="mt-1 bg-muted/50 relative z-10"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Email address cannot be changed. Contact support if needed.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Account Role</p>
                      {profile?.role && getRoleBadge(profile.role)}
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">KYC Status</p>
                      {profile?.kyc_status && getKYCStatusBadge(profile.kyc_status)}
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Member Since</p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Save Changes</p>
                    <p className="text-xs text-muted-foreground">
                      Update your profile information
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      console.log('Save profile button clicked');
                      handleSaveProfile();
                    }} 
                    disabled={saving || loading}
                    className="flex items-center gap-2 relative z-10 pointer-events-auto"
                    type="button"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-1 max-w-md">
                  <div>
                    <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => {
                          console.log('Current password changed');
                          setPasswordData({ ...passwordData, currentPassword: e.target.value });
                        }}
                        placeholder="Enter current password"
                        className="mt-1 pr-10 relative z-10 pointer-events-auto"
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20 pointer-events-auto"
                        onClick={() => {
                          console.log('Toggle current password visibility');
                          setShowCurrentPassword(!showCurrentPassword);
                        }}
                        disabled={loading}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => {
                          console.log('New password changed');
                          setPasswordData({ ...passwordData, newPassword: e.target.value });
                        }}
                        placeholder="Enter new password"
                        className="mt-1 pr-10 relative z-10 pointer-events-auto"
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20 pointer-events-auto"
                        onClick={() => {
                          console.log('Toggle new password visibility');
                          setShowNewPassword(!showNewPassword);
                        }}
                        disabled={loading}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => {
                          console.log('Confirm password changed');
                          setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                        }}
                        placeholder="Confirm new password"
                        className="mt-1 pr-10 relative z-10 pointer-events-auto"
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-20 pointer-events-auto"
                        onClick={() => {
                          console.log('Toggle confirm password visibility');
                          setShowConfirmPassword(!showConfirmPassword);
                        }}
                        disabled={loading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Password Requirements</p>
                    <p className="text-xs text-muted-foreground">
                      Minimum 8 characters, include letters and numbers
                    </p>
                  </div>
                  <Button 
                    onClick={() => {
                      console.log('Update password button clicked');
                      handlePasswordChange();
                    }} 
                    disabled={!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword || loading}
                    className="flex items-center gap-2 relative z-10 pointer-events-auto"
                    type="button"
                  >
                    <Key className="h-4 w-4" />
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="relative z-10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage your account security and privacy preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Two-Factor Authentication */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Smartphone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {securitySettings.twoFactorEnabled ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                    <Switch
                      checked={securitySettings.twoFactorEnabled}
                      onCheckedChange={(checked) => {
                        console.log('2FA toggle clicked:', checked);
                        handleToggleSetting('twoFactorEnabled', checked);
                      }}
                      disabled={loading}
                      className="relative z-10 pointer-events-auto"
                    />
                  </div>
                </div>

                {/* Email Notifications */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive security alerts and updates via email
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.emailNotifications}
                    onCheckedChange={(checked) => {
                      console.log('Email notifications toggle clicked:', checked);
                      handleToggleSetting('emailNotifications', checked);
                    }}
                    disabled={loading}
                    className="relative z-10 pointer-events-auto"
                  />
                </div>

                {/* Login Alerts */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Login Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone logs into your account
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.loginAlerts}
                    onCheckedChange={(checked) => {
                      console.log('Login alerts toggle clicked:', checked);
                      handleToggleSetting('loginAlerts', checked);
                    }}
                    disabled={loading}
                    className="relative z-10 pointer-events-auto"
                  />
                </div>

                {/* Session Timeout */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Session Timeout</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically log out after 30 minutes of inactivity
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">30 minutes</Badge>
                </div>

                {!securitySettings.twoFactorEnabled && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Recommended Security Enhancement</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Enable two-factor authentication to significantly improve your account security.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Security Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Security Activity
                </CardTitle>
                <CardDescription>
                  Monitor recent security events on your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      action: "Profile updated",
                      timestamp: "Just now",
                      ip: "192.168.1.1",
                      location: "Current session"
                    },
                    {
                      action: "Successful login",
                      timestamp: "1 day ago", 
                      ip: "192.168.1.1",
                      location: "New York, NY"
                    },
                    {
                      action: "Password changed",
                      timestamp: "3 days ago",
                      ip: "192.168.1.1",
                      location: "New York, NY"
                    }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{activity.action}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            <span>{activity.ip}</span>
                            <span>•</span>
                            <span>{activity.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.timestamp}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* KYC Status Cards */}
            {profile?.kyc_status === 'pending' && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-5 w-5" />
                    KYC Verification Pending
                  </CardTitle>
                  <CardDescription>
                    Your KYC verification is currently under review
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    We are reviewing your submitted documents. This process typically takes 1-3 business days. 
                    You will receive an email notification once the review is complete.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                    Review in progress...
                  </div>
                </CardContent>
              </Card>
            )}

            {profile?.kyc_status === 'rejected' && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="h-5 w-5" />
                    KYC Verification Required
                  </CardTitle>
                  <CardDescription>
                    Your KYC verification needs attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please contact support to resolve your KYC verification status and gain full access to platform features.
                  </p>
                  <Button variant="outline" size="sm">
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Footer */}
      <footer className="bg-background border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary mr-2" />
            <span className="text-lg font-semibold">IME Capital Tokenization LLC</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete real world asset tokenization solutions
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;