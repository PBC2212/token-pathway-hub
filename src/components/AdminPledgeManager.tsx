import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Coins, 
  Eye, 
  FileText, 
  Shield, 
  RefreshCw,
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
  blockchain_tx_hash?: string;
  blockchain_enabled?: boolean;
  user_id: string;
}

interface PledgeWithUserInfo extends Pledge {
  user_email?: string;
  user_name?: string;
}

const AdminPledgeManager: React.FC = () => {
  const [pledges, setPledges] = useState<PledgeWithUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPledge, setSelectedPledge] = useState<PledgeWithUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form states for approval/rejection
  const [approvalData, setApprovalData] = useState({
    action: 'approve' as 'approve' | 'reject',
    tokenAmount: 0,
    adminNotes: '',
    rejectionReason: ''
  });

  // Asset type mapping for display
  const assetTypeMap: { [key: string]: string } = {
    'real_estate': 'Real Estate',
    'gold': 'Gold',
    'vehicle': 'Vehicle', 
    'art': 'Art',
    'equipment': 'Equipment',
    'commodity': 'Commodity'
  };

  // Status color mapping
  const statusColors: { [key: string]: string } = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'approved': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'tokens_minted': 'bg-blue-100 text-blue-800'
  };

  useEffect(() => {
    fetchPledges();
  }, []);

  const fetchPledges = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get session for authorization
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Not authenticated');
      }

      // Use the new ultra-secure function for accessing pledge data
      const { data: secureData, error: secureError } = await supabase.rpc(
        'get_pledges_ultra_secure',
        { 
          p_access_justification: 'Admin dashboard review for pledge status management and compliance monitoring',
          p_security_level: 'standard',
          p_limit: 50
        }
      );

      if (secureError) {
        throw secureError;
      }

      // Transform the secure data to match our interface
      const pledgesWithUserInfo: PledgeWithUserInfo[] = secureData?.map((pledge: any) => ({
        ...pledge,
        user_email: 'Protected for Privacy',
        user_name: 'Protected for Privacy',
        appraised_value: 0, // Use display value instead
        user_address: pledge.user_address_display || 'Protected'
      })) || [];

      setPledges(pledgesWithUserInfo);

    } catch (err) {
      console.error('Error fetching pledges:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pledges');
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to fetch pledges',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedPledge) return;

    if (approvalData.action === 'approve' && (!approvalData.tokenAmount || approvalData.tokenAmount <= 0)) {
      toast({
        title: "Validation Error",
        description: "Please set a valid token amount for approval",
        variant: "destructive",
      });
      return;
    }

    if (approvalData.action === 'reject' && !approvalData.rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      setActionLoading(selectedPledge.id);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Please log in to perform admin actions');
      }

      const operation = approvalData.action === 'approve' ? 'approve_pledge' : 'reject_pledge';
      
      const requestBody = {
        operation,
        pledgeId: selectedPledge.id,
        adminNotes: approvalData.adminNotes,
        ...(approvalData.action === 'approve' 
          ? { tokenAmount: approvalData.tokenAmount }
          : { rejectionReason: approvalData.rejectionReason }
        )
      };

      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to process pledge action');
      }

      toast({
        title: `Pledge ${approvalData.action}d`,
        description: data.data.message,
      });

      // Reset form and close dialog
      setApprovalData({
        action: 'approve',
        tokenAmount: 0,
        adminNotes: '',
        rejectionReason: ''
      });
      setSelectedPledge(null);
      setDialogOpen(false);

      // Refresh pledges
      fetchPledges();

    } catch (error: any) {
      console.error('Admin action error:', error);
      toast({
        title: "Error",
        description: error.message || 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (pledgeId: string, newStatus: string) => {
    try {
      setActionLoading(pledgeId);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Please log in to perform admin actions');
      }

      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'update_pledge_status',
          pledgeId,
          newStatus,
          adminNotes: `Status updated to ${newStatus}`
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update pledge status');
      }

      toast({
        title: "Status Updated",
        description: data.data.message,
      });

      // Refresh pledges
      fetchPledges();

    } catch (error: any) {
      console.error('Status update error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to update status',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const stats = {
    totalPledges: pledges.length,
    pendingPledges: pledges.filter(p => p.status === 'pending').length,
    approvedPledges: pledges.filter(p => p.status === 'approved').length,
    totalValue: 'Protected for Privacy' // Don't calculate totals for security
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{stats.totalValue}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <div className="text-red-800">{error}</div>
          </div>
        </div>
      )}

      {/* Pledges Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pledge Management</CardTitle>
          <Button onClick={fetchPledges} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
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
                  <TableHead>User</TableHead>
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
                    <TableCell>
                      <div>
                        <div className="font-medium">{pledge.user_name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {pledge.user_address?.substring(0, 10)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {assetTypeMap[pledge.asset_type] || pledge.asset_type}
                    </TableCell>
                    <TableCell>{(pledge as any).appraised_value_display || 'Protected Value'}</TableCell>
                    <TableCell>{getStatusBadge(pledge.status)}</TableCell>
                    <TableCell>{formatDate(pledge.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog open={dialogOpen && selectedPledge?.id === pledge.id} onOpenChange={(open) => {
                          setDialogOpen(open);
                          if (!open) setSelectedPledge(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedPledge(pledge);
                                setApprovalData({
                                  action: 'approve',
                                  tokenAmount: 1000, // Default token amount since we can't calculate from masked value
                                  adminNotes: '',
                                  rejectionReason: ''
                                });
                                setDialogOpen(true);
                              }}
                              disabled={actionLoading === pledge.id}
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
                                {/* Pledge Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>User</Label>
                                    <div className="p-2 bg-muted rounded">
                                      <div className="font-medium">{selectedPledge.user_name}</div>
                                      <div className="text-sm text-muted-foreground">{selectedPledge.user_email}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Asset Type</Label>
                                    <div className="p-2 bg-muted rounded">
                                      {assetTypeMap[selectedPledge.asset_type]}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Appraised Value</Label>
                                    <div className="p-2 bg-muted rounded">
                                      {(selectedPledge as any).appraised_value_display || 'Protected Value'}
                                    </div>
                                  </div>
                                  <div>
                                    <Label>Current Status</Label>
                                    <div className="p-2 bg-muted rounded">
                                      {getStatusBadge(selectedPledge.status)}
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>Description</Label>
                                  <div className="p-2 bg-muted rounded max-h-20 overflow-y-auto">
                                    {selectedPledge.description}
                                  </div>
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
                                            step="1"
                                            value={approvalData.tokenAmount}
                                            onChange={(e) => setApprovalData(prev => ({ ...prev, tokenAmount: parseInt(e.target.value) || 0 }))}
                                            placeholder="Number of tokens to mint"
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
                                        placeholder="Optional notes for your records"
                                      />
                                    </div>
                                    
                                    {approvalData.action === 'reject' && (
                                      <div>
                                        <Label>Rejection Reason *</Label>
                                        <Textarea
                                          value={approvalData.rejectionReason}
                                          onChange={(e) => setApprovalData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                                          rows={2}
                                          placeholder="Reason for rejection (required)"
                                        />
                                      </div>
                                    )}
                                    
                                    <Button 
                                      onClick={handleApprovalAction} 
                                      className="w-full"
                                      disabled={actionLoading === selectedPledge.id}
                                    >
                                      {actionLoading === selectedPledge.id ? (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                      ) : null}
                                      {approvalData.action === 'approve' ? 'Approve Pledge' : 'Reject Pledge'}
                                    </Button>
                                  </div>
                                )}

                                {selectedPledge.status === 'approved' && (
                                  <div className="border-t pt-4">
                                    <Button
                                      onClick={() => handleStatusUpdate(selectedPledge.id, 'tokens_minted')}
                                      disabled={actionLoading === selectedPledge.id}
                                      className="w-full"
                                    >
                                      {actionLoading === selectedPledge.id ? (
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                      ) : (
                                        <Coins className="h-4 w-4 mr-2" />
                                      )}
                                      Mark as Tokens Minted
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPledgeManager;