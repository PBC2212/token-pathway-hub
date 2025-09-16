import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Coins, 
  Eye, 
  FileText, 
  Shield, 
  TrendingUp,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Pledge {
  id: string;
  pledge_id?: number;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol?: string;
  contract_address?: string;
  description?: string;
  document_hash?: string;
  appraisal_date?: string;
  appraiser_license?: string;
  status: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  token_amount?: number;
  nft_token_id?: number;
  admin_notes?: string;
  rejection_reason?: string;
  updated_at?: string;
  tx_hash?: string;
}

interface BlockchainTransaction {
  id: string;
  transaction_id: string;
  transaction_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  user_address?: string;
  contract_address?: string;
  transaction_data?: any;
}

const AdminDashboard = () => {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [approvalData, setApprovalData] = useState({
    action: 'approve' as 'approve' | 'reject',
    tokenAmount: 0,
    adminNotes: '',
    rejectionReason: ''
  });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        throw new Error('Not authenticated');
      }

      // Check if user is admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', session.session.user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        throw new Error('Admin access required');
      }

      // Fetch all pledges
      const { data: pledgesData, error: pledgesError } = await supabase
        .from('pledges')
        .select('*')
        .order('created_at', { ascending: false });

      if (pledgesError) {
        throw pledgesError;
      }

      setPledges(pledgesData || []);

      // Fetch blockchain transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('blockchain_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (transactionsError) {
        console.error('Error fetching transactions:', transactionsError);
        setTransactions([]);
      } else {
        setTransactions(transactionsData || []);
      }

    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: error.message || 'Failed to load admin dashboard data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedPledge) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Please log in to approve pledges');
      }

      const { data, error } = await supabase.functions.invoke('approve-pledge', {
        body: {
          pledgeId: selectedPledge.id,
          action: approvalData.action,
          tokenAmount: approvalData.tokenAmount,
          adminNotes: approvalData.adminNotes,
          rejectionReason: approvalData.rejectionReason
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to process approval');
      }

      toast({
        title: `Pledge ${approvalData.action}d`,
        description: `Pledge has been ${approvalData.action}d successfully`,
      });

      // Refresh data
      fetchAdminData();
      setSelectedPledge(null);

    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        variant: "destructive",
        title: "Error Processing Approval",
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, label: 'Pending', icon: Clock },
      approved: { variant: 'default' as const, label: 'Approved', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejected', icon: XCircle },
      tokens_minted: { variant: 'default' as const, label: 'Tokens Minted', icon: Coins }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = {
    totalPledges: pledges.length,
    pendingPledges: pledges.filter(p => p.status === 'pending').length,
    approvedPledges: pledges.filter(p => p.status === 'approved').length,
    totalValue: pledges.reduce((sum, p) => sum + (p.appraised_value || 0), 0)
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pledges</p>
                <p className="text-2xl font-bold">{stats.totalPledges}</p>
              </div>
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pendingPledges}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{stats.approvedPledges}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pledges Management */}
      <Tabs defaultValue="pledges" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pledges">Pledges</TabsTrigger>
          <TabsTrigger value="transactions">Blockchain Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pledges">
          <Card>
            <CardHeader>
              <CardTitle>Pledge Management</CardTitle>
            </CardHeader>
            <CardContent>
              {pledges.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Pledges Yet</h3>
                  <p className="text-muted-foreground">Pledges will appear here once users create them.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Address</TableHead>
                      <TableHead>Asset Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pledges.map((pledge) => (
                      <TableRow key={pledge.id}>
                        <TableCell className="font-mono text-sm">
                          {pledge.user_address.substring(0, 10)}...
                        </TableCell>
                        <TableCell>
                          {pledge.asset_type.replace('_', ' ').toUpperCase()}
                        </TableCell>
                        <TableCell>{formatCurrency(pledge.appraised_value)}</TableCell>
                        <TableCell>{getStatusBadge(pledge.status)}</TableCell>
                        <TableCell>{formatDate(pledge.created_at)}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedPledge(pledge)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Review Pledge</DialogTitle>
                                <DialogDescription>
                                  Review and approve or reject this asset pledge.
                                </DialogDescription>
                              </DialogHeader>
                              
                              {selectedPledge && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>User Address</Label>
                                      <Input value={selectedPledge.user_address} readOnly />
                                    </div>
                                    <div>
                                      <Label>Asset Type</Label>
                                      <Input value={selectedPledge.asset_type} readOnly />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Appraised Value</Label>
                                      <Input value={formatCurrency(selectedPledge.appraised_value)} readOnly />
                                    </div>
                                    <div>
                                      <Label>Token Symbol</Label>
                                      <Input value={selectedPledge.token_symbol} readOnly />
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label>Description</Label>
                                    <Textarea value={selectedPledge.description} readOnly rows={3} />
                                  </div>

                                  {selectedPledge.status === 'pending' && (
                                    <div className="space-y-4 border-t pt-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label>Action</Label>
                                          <Select 
                                            value={approvalData.action} 
                                            onValueChange={(value) => setApprovalData(prev => ({ ...prev, action: value as 'approve' | 'reject' }))}
                                          >
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="approve">Approve</SelectItem>
                                              <SelectItem value="reject">Reject</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        {approvalData.action === 'approve' && (
                                          <div>
                                            <Label>Token Amount</Label>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={approvalData.tokenAmount}
                                              onChange={(e) => setApprovalData(prev => ({ ...prev, tokenAmount: parseFloat(e.target.value) || 0 }))}
                                            />
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div>
                                        <Label>Admin Notes</Label>
                                        <Textarea
                                          value={approvalData.adminNotes}
                                          onChange={(e) => setApprovalData(prev => ({ ...prev, adminNotes: e.target.value }))}
                                          rows={2}
                                        />
                                      </div>
                                      
                                      {approvalData.action === 'reject' && (
                                        <div>
                                          <Label>Rejection Reason</Label>
                                          <Textarea
                                            value={approvalData.rejectionReason}
                                            onChange={(e) => setApprovalData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                                            rows={2}
                                          />
                                        </div>
                                      )}
                                      
                                      <Button onClick={handleApprovalAction} className="w-full">
                                        {approvalData.action === 'approve' ? 'Approve Pledge' : 'Reject Pledge'}
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Blockchain Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
                  <p className="text-muted-foreground">Blockchain transactions will appear here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-sm">
                          {tx.transaction_id.substring(0, 20)}...
                        </TableCell>
                        <TableCell>{tx.transaction_type}</TableCell>
                        <TableCell>
                          <Badge variant={tx.status === 'COMPLETED' ? 'default' : tx.status === 'FAILED' ? 'destructive' : 'secondary'}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(tx.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;