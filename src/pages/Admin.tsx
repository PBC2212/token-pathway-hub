import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Users, FileText, UserCheck, Database, Plus, RefreshCw, Shield } from 'lucide-react';
import VaultManager from '@/components/VaultManager';
import AdminPledgeManager from '@/components/AdminPledgeManager';
import AuditLogsViewer from '@/components/AuditLogsViewer';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  kyc_status: string;
  created_at: string;
}

interface UserAgreement {
  id: string;
  user_id: string;
  agreement_type_id: string;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  profiles: { email: string; full_name: string } | null;
  agreement_types: { name: string } | null;
}

export default function Admin() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userAgreements, setUserAgreements] = useState<UserAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New user form state
  const [newUser, setNewUser] = useState({
    user_id: '',
    email: '',
    full_name: '',
    role: 'user',
    kyc_status: 'pending'
  });

  useEffect(() => {
    checkAdminAccess();
    fetchData();
  }, []);

  const checkAdminAccess = async () => {
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page.",
        variant: "destructive",
      });
      window.location.href = '/dashboard';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Fetch user agreements with related data
      const { data: agreementsData, error: agreementsError } = await supabase
        .from('user_agreements')
        .select('*')
        .order('created_at', { ascending: false });

      if (agreementsError) throw agreementsError;
      
      // Fetch related profile and agreement type data separately to avoid join issues
      const agreementsWithDetails = await Promise.all(
        (agreementsData || []).map(async (agreement) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', agreement.user_id)
            .single();
            
          const { data: agreementType } = await supabase
            .from('agreement_types')
            .select('name')
            .eq('id', agreement.agreement_type_id)
            .single();
            
          return {
            ...agreement,
            profiles: profile,
            agreement_types: agreementType
          };
        })
      );
      
      setUserAgreements(agreementsWithDetails);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const createUser = async () => {
    if (!newUser.user_id || !newUser.email || !newUser.full_name) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: newUser.user_id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          kyc_status: newUser.kyc_status
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User profile created successfully.",
      });

      setNewUser({
        user_id: '',
        email: '',
        full_name: '',
        role: 'user',
        kyc_status: 'pending'
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateKYCStatus = async (profileId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ kyc_status: newStatus })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "KYC status updated successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (profileId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'pending': return 'bg-orange-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage users, agreements, and KYC approvals</p>
          </div>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="pledges" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="pledges" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Pledges
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="agreements" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Agreements
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              KYC Management
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pledges" className="space-y-4">
            <AdminPledgeManager />
          </TabsContent>

          <TabsContent value="pledges">
            <AdminPledgeManager />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Profiles ({profiles.length})
                </CardTitle>
                <CardDescription>
                  Manage user accounts, roles, and KYC status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{profile.full_name}</div>
                        <div className="text-sm text-gray-600">{profile.email}</div>
                        <div className="flex gap-2">
                          <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                            {profile.role}
                          </Badge>
                          <Badge className={getStatusBadgeColor(profile.kyc_status)}>
                            {profile.kyc_status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Select 
                          value={profile.role} 
                          onValueChange={(value) => updateUserRole(profile.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select 
                          value={profile.kyc_status} 
                          onValueChange={(value) => updateKYCStatus(profile.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agreements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  User Agreements ({userAgreements.length})
                </CardTitle>
                <CardDescription>
                  Track agreement completion and approval status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userAgreements.map((agreement) => (
                    <div key={agreement.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">{agreement.profiles?.full_name}</div>
                        <div className="text-sm text-gray-600">{agreement.profiles?.email}</div>
                        <div className="text-sm font-medium">{agreement.agreement_types?.name}</div>
                        {agreement.submitted_at && (
                          <div className="text-xs text-gray-500">
                            Submitted: {new Date(agreement.submitted_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <Badge className={getStatusBadgeColor(agreement.status)}>
                        {agreement.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyc" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  KYC Status Overview
                </CardTitle>
                <CardDescription>
                  Quick overview of KYC approval status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {profiles.filter(p => p.kyc_status === 'pending').length}
                    </div>
                    <div className="text-sm text-orange-600">Pending</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {profiles.filter(p => p.kyc_status === 'approved').length}
                    </div>
                    <div className="text-sm text-green-600">Approved</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {profiles.filter(p => p.kyc_status === 'rejected').length}
                    </div>
                    <div className="text-sm text-red-600">Rejected</div>
                  </div>
                </div>
                <div className="space-y-4">
                  {profiles.filter(p => p.kyc_status === 'pending').map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                      <div>
                        <div className="font-medium">{profile.full_name}</div>
                        <div className="text-sm text-gray-600">{profile.email}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => updateKYCStatus(profile.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => updateKYCStatus(profile.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogsViewer />
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New User Profile
                </CardTitle>
                <CardDescription>
                  Add a new user profile for testing or manual user creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="user_id">User ID</Label>
                    <Input
                      id="user_id"
                      placeholder="UUID of the authenticated user"
                      value={newUser.user_id}
                      onChange={(e) => setNewUser({...newUser, user_id: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kyc_status">KYC Status</Label>
                    <Select value={newUser.kyc_status} onValueChange={(value) => setNewUser({...newUser, kyc_status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={createUser} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create User Profile
                </Button>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Quick Test User</h4>
                  <p className="text-sm text-blue-700 mb-3">Use this for testing:</p>
                  <div className="space-y-2 text-sm font-mono">
                    <div><strong>User ID:</strong> a097e4ed-57f1-46ec-bbb0-0fa3c5f811ba</div>
                    <div><strong>Email:</strong> Your actual registration email</div>
                    <div><strong>Full Name:</strong> Your name</div>
                  </div>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setNewUser({
                      user_id: 'a097e4ed-57f1-46ec-bbb0-0fa3c5f811ba',
                      email: 'test@example.com',
                      full_name: 'Test User',
                      role: 'user',
                      kyc_status: 'pending'
                    })}
                  >
                    Fill Test Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}