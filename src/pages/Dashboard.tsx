import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Shield, FileText, Users, Building, Briefcase, User, Mail, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

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
        return <Badge className="bg-green-100 text-green-800 border-green-200">Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
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
              <h1 className="text-2xl font-bold">Tokenization Portal</h1>
              <p className="text-muted-foreground">Welcome back, {profile?.full_name || user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* User Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Profile
            </CardTitle>
            <CardDescription>
              Your account information and verification status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">{profile?.full_name || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Member Since</p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">Account Role</p>
                  {profile?.role && getRoleBadge(profile.role)}
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">KYC Status</p>
                  {profile?.kyc_status && getKYCStatusBadge(profile.kyc_status)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Welcome Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to Your Dashboard</CardTitle>
            <CardDescription>
              Your secure platform for real estate tokenization agreements and documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This is your central hub for managing tokenization agreements, completing KYC verification, 
              and coordinating with all stakeholders in your real estate tokenization journey.
            </p>
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

        {/* Agreement Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Agreement Documents
            </CardTitle>
            <CardDescription>
              Access and complete required tokenization agreements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/property-pledge-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Property Pledge Agreement</h3>
                  <p className="text-sm text-muted-foreground">Pledge property for tokenization</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/token-issuance-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Token Issuance Agreement</h3>
                  <p className="text-sm text-muted-foreground">Define token issuance terms</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/subscription-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Subscription Agreement</h3>
                  <p className="text-sm text-muted-foreground">Subscribe to token offerings</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/operating-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Operating Agreement (SPV/LLC)</h3>
                  <p className="text-sm text-muted-foreground">Entity operating structure</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/token-holder-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Token Holder Agreement</h3>
                  <p className="text-sm text-muted-foreground">Token holder rights and duties</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/kyc-aml-policy'}
              >
                <div className="text-left">
                  <h3 className="font-medium">KYC/AML Policy</h3>
                  <p className="text-sm text-muted-foreground">Identity verification requirements</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/custody-tokenization-policy'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Custody & Tokenization Policy</h3>
                  <p className="text-sm text-muted-foreground">Asset custody and tokenization terms</p>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 justify-start"
                onClick={() => window.location.href = '/swap-settlement-agreement'}
              >
                <div className="text-left">
                  <h3 className="font-medium">Swap/Settlement Agreement</h3>
                  <p className="text-sm text-muted-foreground">Token trading and settlement terms</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;