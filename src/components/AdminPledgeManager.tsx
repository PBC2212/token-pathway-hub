import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle, XCircle, Clock, Package, Home, Car, Palette, Wrench, Package as PackageIcon } from 'lucide-react';

interface Pledge {
  id: string;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  admin_notes?: string;
}

const assetTypeIcons = {
  real_estate: Home,
  gold: Package,
  vehicle: Car,
  art: Palette,
  equipment: Wrench,
  commodity: PackageIcon
};

const assetTypeLabels = {
  real_estate: 'Real Estate',
  gold: 'Gold',
  vehicle: 'Vehicle',
  art: 'Art & Collectibles',
  equipment: 'Equipment',
  commodity: 'Commodity'
};

const AdminPledgeManager = () => {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<Pledge | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  const fetchPledges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pledges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pledges:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch pledges',
          variant: 'destructive'
        });
        return;
      }

      setPledges(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch pledges',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePledgeAction = async (action: 'approve' | 'reject') => {
    if (!selectedPledge) return;

    try {
      setLoading(true);
      const { error } = await supabase.rpc('update_pledge_status', {
        p_pledge_id: selectedPledge.id,
        p_status: action === 'approve' ? 'approved' : 'rejected',
        p_admin_notes: adminNotes || undefined
      });

      if (error) {
        console.error('Error updating pledge:', error);
        toast({
          title: 'Error',
          description: `Failed to ${action} pledge`,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: `Pledge ${action === 'approve' ? 'approved' : 'rejected'} successfully`
      });

      setActionDialogOpen(false);
      setSelectedPledge(null);
      setAdminNotes('');
      setPendingAction(null);
      await fetchPledges();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: `Failed to ${action} pledge`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const openActionDialog = (pledge: Pledge, action: 'approve' | 'reject') => {
    setSelectedPledge(pledge);
    setPendingAction(action);
    setAdminNotes(pledge.admin_notes || '');
    setActionDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  useEffect(() => {
    fetchPledges();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Pledge Management</h2>
        </div>
        <Button onClick={fetchPledges} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {loading && pledges.length === 0 ? (
        <div className="text-center py-8">Loading pledges...</div>
      ) : (
        <div className="space-y-4">
          {pledges.map((pledge) => {
            const IconComponent = assetTypeIcons[pledge.asset_type as keyof typeof assetTypeIcons] || Package;
            
            return (
              <Card key={pledge.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {assetTypeLabels[pledge.asset_type as keyof typeof assetTypeLabels] || pledge.asset_type}
                    </div>
                    {getStatusBadge(pledge.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">User Address</Label>
                      <p className="font-mono text-sm">{pledge.user_address.slice(0, 10)}...{pledge.user_address.slice(-8)}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Appraised Value</Label>
                      <p className="font-semibold">${pledge.appraised_value.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Token Amount</Label>
                      <p className="font-semibold">{pledge.token_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Submitted</Label>
                      <p className="text-sm">{formatDate(pledge.created_at)}</p>
                    </div>
                  </div>

                  {pledge.admin_notes && (
                    <div className="mb-4">
                      <Label className="text-sm text-muted-foreground">Admin Notes</Label>
                      <p className="text-sm bg-muted p-2 rounded">{pledge.admin_notes}</p>
                    </div>
                  )}

                  {pledge.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => openActionDialog(pledge, 'approve')}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => openActionDialog(pledge, 'reject')}
                        className="flex items-center gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {pledge.status === 'approved' && pledge.approved_at && (
                    <div className="text-sm text-muted-foreground">
                      Approved on {formatDate(pledge.approved_at)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {pledges.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              No pledges found
            </div>
          )}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'approve' ? 'Approve' : 'Reject'} Pledge
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'approve' 
                ? 'Approving this pledge will allow the user to mint tokens for their asset.'
                : 'Rejecting this pledge will prevent the user from minting tokens for this asset.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedPledge && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Asset Type</Label>
                  <p>{assetTypeLabels[selectedPledge.asset_type as keyof typeof assetTypeLabels] || selectedPledge.asset_type}</p>
                </div>
                <div>
                  <Label>Appraised Value</Label>
                  <p>${selectedPledge.appraised_value.toLocaleString()}</p>
                </div>
                <div>
                  <Label>Token Amount</Label>
                  <p>{selectedPledge.token_amount.toLocaleString()}</p>
                </div>
                <div>
                  <Label>User Address</Label>
                  <p className="font-mono">{selectedPledge.user_address.slice(0, 10)}...{selectedPledge.user_address.slice(-8)}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this decision..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handlePledgeAction(pendingAction!)}
              disabled={loading}
              variant={pendingAction === 'approve' ? 'default' : 'destructive'}
            >
              {loading ? 'Processing...' : pendingAction === 'approve' ? 'Approve Pledge' : 'Reject Pledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPledgeManager;