import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LogOut, FileText, CheckCircle, Clock, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AgreementType {
  id: string;
  name: string;
  description: string;
  help_text?: string;
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

  const handleAgreementClick = async (agreement: AgreementType) => {
    if (!canAccessAgreement(agreement)) {
      toast({
        title: "KYC Required",
        description: "Please complete your KYC verification first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!agreement.cognito_form_url) {
      toast({
        title: "Form Not Available",
        description: "This agreement form is not yet configured.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update status to in_progress
      const { error } = await supabase
        .from('user_agreements')
        .upsert({
          user_id: user.id,
          agreement_type_id: agreement.id,
          status: 'in_progress'
        }, {
          onConflict: 'user_id,agreement_type_id'
        });

      if (error) throw error;

      // Refresh data immediately
      fetchUserData();

      // Construct URL with hidden field parameters
      const formUrl = new URL(agreement.cognito_form_url);
      formUrl.searchParams.set('Entry.UserId', user.id);
      formUrl.searchParams.set('Entry.AgreementTypeId', agreement.id);
      formUrl.searchParams.set('Entry.PortalSessionId', Date.now().toString());

      console.log('Opening form URL:', formUrl.toString()); // Debug log

      // Open form in new tab
      window.open(formUrl.toString(), '_blank');
      
      toast({
        title: "Form Opened",
        description: "Complete the form in the new tab. Return here to see your progress.",
      });

    } catch (error: any) {
      console.error('Error opening agreement:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
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
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={fetchUserData} size="sm">
              Refresh Status
            </Button>
            <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
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
              <p className="text-xs text-muted-foreground">
                {progress === 100 ? 'All agreements completed!' : `${Math.round(progress)}% complete`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Debug Information */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-sm">
              <p><strong>Debug Info:</strong></p>
              <p>User ID: {user.id}</p>
              <p>Agreements loaded: {agreements.length}</p>
              <p>User agreements: {userAgreements.length}</p>
              <p>Completed count: {completedCount}</p>
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
                } ${status === 'completed' || status === 'approved' ? 'ring-2 ring-green-200' : ''}`}
                onClick={() => handleAgreementClick(agreement)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(status)}
                        {agreement.name}
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {agreement.help_text || agreement.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    <p>Agreement ID: {agreement.id}</p>
                    <p>Status: {status}</p>
                  </div>
                  {agreement.requires_kyc && profile?.kyc_status !== 'approved' && (
                    <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded mt-2">
                      <AlertCircle className="h-3 w-3" />
                      Requires KYC approval
                    </div>
                  )}
                  {!agreement.cognito_form_url && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                      <AlertCircle className="h-3 w-3" />
                      Form not yet configured
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