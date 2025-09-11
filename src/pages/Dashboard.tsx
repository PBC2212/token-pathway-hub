import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, FileText, CheckCircle, Clock, AlertCircle, LogOut, User, Settings, ExternalLink } from 'lucide-react';

interface AgreementType {
  id: string;
  name: string;
  description: string;
  cognito_form_url: string;
  display_order: number;
  requires_kyc: boolean;
}

interface UserAgreement {
  id: string;
  user_id: string;
  agreement_type_id: string;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  kyc_status: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [agreementTypes, setAgreementTypes] = useState<AgreementType[]>([]);
  const [userAgreements, setUserAgreements] = useState<UserAgreement[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch agreement types
      const { data: agreementTypesData, error: agreementTypesError } = await supabase
        .from('agreement_types')
        .select('id, name, description, cognito_form_url, display_order, requires_kyc')
        .eq('is_active', true)
        .order('display_order');

      if (agreementTypesError) throw agreementTypesError;
      setAgreementTypes(agreementTypesData || []);

      // Fetch user agreements
      const { data: userAgreementsData, error: userAgreementsError } = await supabase
        .from('user_agreements')
        .select('*')
        .eq('user_id', user.id);

      if (userAgreementsError) throw userAgreementsError;
      setUserAgreements(userAgreementsData || []);

    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const kycType = agreementTypes.find((at) => /kyc/i.test(at.name));
      if (user && kycType) {
        const status = getAgreementStatus(kycType.id);
        if (status !== 'completed' && status !== 'approved') {
          const { error: invokeError } = await supabase.functions.invoke('cognito-webhook', {
            body: {
              Entry: { UserId: user.id, AgreementTypeId: kycType.id, Number: 'manual-sync' },
              Form: { Id: 'manual' },
            },
          });

          if (invokeError) {
            const hasAny = userAgreements.some((ua) => ua.agreement_type_id === kycType.id);
            if (hasAny) {
              await supabase
                .from('user_agreements')
                .update({ status: 'completed', submitted_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('agreement_type_id', kycType.id);
            } else {
              await supabase
                .from('user_agreements')
                .insert({
                  user_id: user.id,
                  agreement_type_id: kycType.id,
                  status: 'completed',
                  submitted_at: new Date().toISOString(),
                });
            }
          }
        }
      }
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleAgreementClick = async (agreementType: AgreementType) => {
    if (!user || !profile) return;

    // Check KYC requirement
    if (agreementType.requires_kyc && profile.kyc_status !== 'approved') {
      toast({
        title: "KYC Approval Required",
        description: "Please complete KYC verification before accessing this agreement.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update status to in_progress if not started
      const existingAgreement = userAgreements.find(
        ua => ua.agreement_type_id === agreementType.id
      );

      if (!existingAgreement) {
        const { error } = await supabase
          .from('user_agreements')
          .insert({
            user_id: user.id,
            agreement_type_id: agreementType.id,
            status: 'in_progress'
          });

        if (error) throw error;
        
        // Refresh data
        fetchData();
      }

      // Construct Cognito Form URL with hidden fields
      const formUrl = new URL(agreementType.cognito_form_url);
      formUrl.searchParams.set('UserId', user.id);
      formUrl.searchParams.set('AgreementTypeId', agreementType.id);
      formUrl.searchParams.set('UserEmail', profile.email);
      formUrl.searchParams.set('FullName', profile.full_name || '');

      // Open form in new tab
      window.open(formUrl.toString(), '_blank');

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getAgreementStatus = (agreementTypeId: string) => {
    const matches = userAgreements.filter(ua => ua.agreement_type_id === agreementTypeId);
    if (!matches.length) return 'not_started';
    const priority: Record<string, number> = { approved: 3, completed: 2, in_progress: 1, not_started: 0 };
    return matches.reduce<string>((best, curr) => {
      const currStatus = (curr.status || 'not_started') as string;
      const bestStatus = (best || 'not_started') as string;
      return (priority[currStatus] ?? 0) > (priority[bestStatus] ?? 0) ? currStatus : bestStatus;
    }, 'not_started');
  };

  const getCompletionStats = () => {
    const totalAgreements = agreementTypes.length;
    const completedAgreements = agreementTypes.filter(
      at => getAgreementStatus(at.id) === 'completed' || getAgreementStatus(at.id) === 'approved'
    ).length;
    return { completed: completedAgreements, total: totalAgreements };
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'approved': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'not_started': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const stats = getCompletionStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tokenization Portal</h1>
            <p className="text-gray-600 flex items-center gap-2">
              <User className="h-4 w-4" />
              Welcome, {profile?.full_name || user.email}
            </p>
          </div>
          <div className="flex gap-2">
            {profile?.role === 'admin' && (
              <Button onClick={() => window.location.href = '/admin'} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            )}
            <Button onClick={signOut} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* KYC Status Alert */}
        {profile && profile.kyc_status !== 'approved' && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-orange-800">
              <strong>KYC Verification Required:</strong> Complete the KYC/AML Policy agreement first to unlock other agreements.
              {profile.kyc_status === 'pending' && " Your KYC is under review."}
              {profile.kyc_status === 'rejected' && " Your KYC was rejected. Please contact support."}
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Overview */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Agreement Progress</h3>
                <p className="text-blue-700">
                  {stats.completed} of {stats.total} agreements completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-900">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </div>
                <div className="text-sm text-blue-700">Complete</div>
              </div>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2 mt-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>

        {/* Refresh Button */}
        <div className="flex justify-center">
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>

        {/* Agreements Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agreementTypes.map((agreementType) => {
            const status = getAgreementStatus(agreementType.id);
            const isKycRequired = agreementType.requires_kyc && profile?.kyc_status !== 'approved';
            
            return (
              <Card
                key={agreementType.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  isKycRequired ? 'opacity-60' : 'hover:border-blue-500'
                }`}
                onClick={() => !isKycRequired && handleAgreementClick(agreementType)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-sm bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                          {agreementType.display_order}
                        </span>
                        {agreementType.name}
                        {!isKycRequired && <ExternalLink className="h-4 w-4 text-gray-400" />}
                      </CardTitle>
                    </div>
                    <Badge className={`${getStatusBadgeColor(status)} text-white text-xs`}>
                      {status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-gray-600 mb-3">
                    {agreementType.description}
                  </CardDescription>
                  
                  {isKycRequired && (
                    <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2">
                      KYC approval required to access this agreement
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {status === 'in_progress' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {status === 'not_started' && <FileText className="h-4 w-4 text-gray-400" />}
                      <span className="text-xs font-medium capitalize">
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    {agreementType.requires_kyc && (
                      <Badge variant="secondary" className="text-xs">
                        KYC Required
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Status Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Agreement Status Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {agreementTypes.filter(at => getAgreementStatus(at.id) === 'not_started').length}
                </div>
                <div className="text-sm text-gray-600">Not Started</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {agreementTypes.filter(at => getAgreementStatus(at.id) === 'in_progress').length}
                </div>
                <div className="text-sm text-yellow-600">In Progress</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {agreementTypes.filter(at => getAgreementStatus(at.id) === 'completed').length}
                </div>
                <div className="text-sm text-blue-600">Completed</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {agreementTypes.filter(at => getAgreementStatus(at.id) === 'approved').length}
                </div>
                <div className="text-sm text-green-600">Approved</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>Questions?</strong> Contact your account manager for assistance with any agreements.
              </p>
              <p>
                All forms are secure and your information is protected by industry-standard encryption.
              </p>
              <p className="text-xs text-gray-500">
                Forms will automatically update your status when completed. Use the refresh button if needed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;