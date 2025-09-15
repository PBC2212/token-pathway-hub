import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VaultManager from '@/components/VaultManager';
import { LogOut, Shield, FileText, Users, Building, Briefcase, User, Mail, Calendar, Vault, Settings, Coins, TrendingUp, DollarSign, Droplets, ExternalLink, Clock, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  role: string;
  kyc_status: string;
  created_at: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const fetchUserProfile = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Profile Error",
          description: "Could not load your profile information.",
          variant: "destructive",
        });
      } else {
        setProfile(profileData);
      }
    } catch (error: any) {
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your profile...</p>
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
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">0</div>
                    <div className="text-sm text-muted-foreground">Assets Pledged</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <div className="text-sm text-muted-foreground">Tokens Minted</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <div className="text-sm text-muted-foreground">Active Vaults</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-muted-foreground">Documents Signed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

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

          <TabsContent value="profile" className="space-y-6">
            {/* Enhanced User Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Full Name</p>
                        <p className="text-sm text-muted-foreground">{profile?.full_name || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Member Since</p>
                        <p className="text-sm text-muted-foreground">
                          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
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
                      <p className="text-sm font-medium mb-2">Account Actions</p>
                      <div className="space-y-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => navigate('/account-settings')}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Account Settings
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => navigate('/security-settings')}
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Security Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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