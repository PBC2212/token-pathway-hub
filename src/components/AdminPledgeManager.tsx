import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Eye, CheckCircle, XCircle, DollarSign, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Pledge {
  id: string;
  user_id: string;
  user_email: string;
  asset_type: string;
  appraised_value_masked: string;
  status: string;
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  description?: string;
  appraisal_date?: string;
  appraiser_license?: string;
  document_hash?: string;
}

interface PledgeSummary {
  total_pledges: number;
  pending_pledges: number;
  approved_pledges: number;
  total_appraised_value: number;
}

const AdminPledgeManager = () => {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [summary, setSummary] = useState<PledgeSummary>({
    total_pledges: 0,
    pending_pledges: 0,
    approved_pledges: 0,
    total_appraised_value: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchPledges();
    setupRealtimeSubscription();
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('pledge-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pledges'
        },
        (payload) => {
          console.log('Real-time pledge update:', payload);
          fetchPledges(); // Refresh data on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchPledges = async () => {
    try {
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to access admin features',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'get_pledges',
          maskFinancialData: false,
          limit: 100
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success && data?.data?.pledges) {
        setPledges(data.data.pledges);
        
        // Calculate summary
        const total = data.data.pledges.length;
        const pending = data.data.pledges.filter((p: Pledge) => p.status === 'pending').length;
        const approved = data.data.pledges.filter((p: Pledge) => p.status === 'approved').length;
        const totalValue = data.data.pledges.reduce((sum: number, p: Pledge) => {
          // Extract numeric value from masked string like "$123,456" or "***,***"
          const numericValue = p.appraised_value_masked?.includes('***') ? 0 : 
            parseFloat(p.appraised_value_masked?.replace(/[^0-9.]/g, '') || '0');
          return sum + numericValue;
        }, 0);

        setSummary({
          total_pledges: total,
          pending_pledges: pending,
          approved_pledges: approved,
          total_appraised_value: totalValue
        });
      }
    } catch (error) {
      console.error('Error fetching pledges:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pledges. Please check your admin permissions.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePledgeAction = async () => {
    if (!selectedPledge || !actionType) return;

    if (actionType === 'approve' && !tokenAmount) {
      toast({
        title: 'Token Amount Required',
        description: 'Please enter the token amount for approval',
        variant: 'destructive'
      });
      return;
    }

    if (actionType === 'reject' && !rejectionReason) {
      toast({
        title: 'Rejection Reason Required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive'
      });
      return;
    }

    try {
      setActionLoading(true);
      const { data: session } = await supabase.auth.getSession();

      const operation = actionType === 'approve' ? 'approve_pledge' : 'reject_pledge';
      const requestBody = {
        operation,
        pledgeId: selectedPledge.id,
        ...(actionType === 'approve' ? {
          tokenAmount: parseFloat(tokenAmount),
          adminNotes
        } : {
          rejectionReason,
          adminNotes
        })
      };

      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: `Pledge ${actionType === 'approve' ? 'Approved' : 'Rejected'}`,
          description: actionType === 'approve' 
            ? `Pledge approved with ${tokenAmount} tokens` 
            : 'Pledge has been rejected',
        });

        // Reset form and close dialog
        setTokenAmount('');
        setRejectionReason('');
        setAdminNotes('');
        setSelectedPledge(null);
        setActionType(null);
        setDialogOpen(false);

        // Refresh pledges
        fetchPledges();
      }
    } catch (error) {
      console.error('Error processing pledge action:', error);
      toast({
        title: 'Action Failed',
        description: `Failed to ${actionType} pledge. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (pledge: Pledge, action: 'approve' | 'reject') => {
    setSelectedPledge(pledge);
    setActionType(action);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'tokens_minted':
        return <Badge variant="default"><TrendingUp className="h-3 w-3 mr-1" />Tokens Minted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Admin Pledge Management</h1>
          <p className="text-muted-foreground">Review and manage asset pledges</p>
        </div>
        <Button onClick={fetchPledges} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pledges</p>
                <p className="text-2xl font-bold">{summary.total_pledges}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{summary.pending_pledges}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{summary.approved_pledges}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {summary.total_appraised_value > 0 
                    ? `$${summary.total_appraised_value.toLocaleString()}` 
                    : 'Secured'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pledges Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pledge Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Appraised Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pledges.map((pledge) => (
                  <TableRow key={pledge.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pledge.user_email}</p>
                        <p className="text-sm text-muted-foreground">ID: {pledge.user_id.slice(0, 8)}...</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pledge.asset_type.replace('_', ' ').toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{pledge.appraised_value_masked}</TableCell>
                    <TableCell>{getStatusBadge(pledge.status)}</TableCell>
                    <TableCell>{formatDate(pledge.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Pledge Details</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>User Email</Label>
                                  <p className="text-sm">{pledge.user_email}</p>
                                </div>
                                <div>
                                  <Label>Asset Type</Label>
                                  <p className="text-sm">{pledge.asset_type}</p>
                                </div>
                                <div>
                                  <Label>Appraised Value</Label>
                                  <p className="text-sm">{pledge.appraised_value_masked}</p>
                                </div>
                                <div>
                                  <Label>Status</Label>
                                  <div className="text-sm">{getStatusBadge(pledge.status)}</div>
                                </div>
                              </div>
                              {pledge.admin_notes && (
                                <div>
                                  <Label>Admin Notes</Label>
                                  <p className="text-sm">{pledge.admin_notes}</p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {pledge.status === 'pending' && (
                          <>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => openActionDialog(pledge, 'approve')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => openActionDialog(pledge, 'reject')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {pledges.length === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No pledges found</h3>
              <p className="text-muted-foreground">No pledges have been submitted yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Pledge' : 'Reject Pledge'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPledge && (
              <div className="p-4 bg-muted rounded-lg">
                <p><strong>User:</strong> {selectedPledge.user_email}</p>
                <p><strong>Asset:</strong> {selectedPledge.asset_type}</p>
                <p><strong>Value:</strong> {selectedPledge.appraised_value_masked}</p>
              </div>
            )}

            {actionType === 'approve' && (
              <div>
                <Label htmlFor="tokenAmount">Token Amount *</Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="Enter token amount"
                  step="0.01"
                />
              </div>
            )}

            {actionType === 'reject' && (
              <div>
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection"
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
              <Textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Additional notes for internal use"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handlePledgeAction}
                disabled={actionLoading}
                variant={actionType === 'approve' ? 'default' : 'destructive'}
              >
                {actionLoading ? 'Processing...' : actionType === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPledgeManager;