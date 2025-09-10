import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LogOut, FileText, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AgreementType {
  id: string;
  name: string;
  description: string;
  requires_kyc: boolean;
  display_order: number;
  cognito_form_url?: string;
}

interface UserAgreement {
  id: string;
  agreement_type_id: string;
  status: string;
  submitted_at?: string;
  approved_at?: string;
}

interface Profile {
  kyc_status: string;
  full_name?: string;
  role: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agreements, setAgreements] = useState<AgreementType[]>([]);
  const [userAgreements, setUserAgreements] = useState<UserAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch agreement types
      const { data: agreementData, error: agreementError } = await supabase
        .from('agreement_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (agreementError) throw agreementError;
      setAgreements(agreementData);

      // Fetch user agreements
      const { data: userAgreementData, error: userAgreementError } = await supabase
        .from('user_agreements')
        .select('*')
        .eq('user_id', user.id);

      if (userAgreementError) throw userAgreementError;
      setUserAgreements(userAgreementData || []);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAgreementStatus = (agreementId: string) => {
    const userAgreement = userAgreements.find(ua => ua.agreement_type_id === agreementId);
    return userAgreement?.status || 'not_started';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">In Progress</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const canAccessAgreement = (agreement: AgreementType) => {
    if (!agreement.requires_kyc) return true;
    return profile?.kyc_status === 'approved';
  };

  const handleAgreementClick = (agreement: AgreementType) => {
    if (!canAccessAgreement(agreement)) {
      toast({
        title: "KYC Required",
        description: "Please complete your KYC verification first.",
        variant: "destructive",
      });
      return;
    }
    
    // For now, show a placeholder message. Later this will open Cognito forms
    toast({
      title: "Agreement Access",
      description: `Opening ${agreement.name}. Cognito Forms integration coming soon.`,
    });
  };

  const completedCount = userAgreements.filter(ua => 
    ua.status === 'completed' || ua.status === 'approved'
  ).length;
  const totalCount = agreements.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
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
          <div>
            <h1 className="text-2xl font-bold">Tokenization Portal</h1>
            <p className="text-muted-foreground">Welcome back, {profile?.full_name || user.email}</p>
          </div>
          <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* KYC Status Alert */}
        {profile?.kyc_status === 'pending' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">KYC Verification Required</p>
                  <p className="text-sm text-yellow-700">Complete your KYC/AML verification to access all agreements.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Agreement Progress</CardTitle>
            <CardDescription>
              Complete all agreements to finalize your tokenization onboarding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completed Agreements</span>
                <span>{completedCount} of {totalCount}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Agreements Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agreements.map((agreement) => {
            const status = getAgreementStatus(agreement.id);
            const canAccess = canAccessAgreement(agreement);
            
            return (
              <Card
                key={agreement.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  !canAccess ? 'opacity-60' : ''
                }`}
                onClick={() => handleAgreementClick(agreement)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(status)}
                        {agreement.name}
                      </CardTitle>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {agreement.description}
                  </p>
                  {agreement.requires_kyc && profile?.kyc_status !== 'approved' && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                      <AlertCircle className="h-3 w-3" />
                      Requires KYC approval
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;