import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Vault, Wallet, ArrowRightLeft, Plus, Shield } from 'lucide-react';

interface VaultData {
  id: string;
  name: string;
  assets: any[];
  hiddenOnUI: boolean;
  customerRefId?: string;
}

interface AssetData {
  id: string;
  total: string;
  balance: string;
  available: string;
  pending: string;
  frozen: string;
  lockedAmount: string;
}

const VaultManager = () => {
  const { toast } = useToast();
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(false);
  const [createVaultOpen, setCreateVaultOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // Create vault form state
  const [newVaultName, setNewVaultName] = useState('');
  const [hiddenOnUI, setHiddenOnUI] = useState(false);
  const [customerRefId, setCustomerRefId] = useState('');

  // Transfer form state
  const [transferAmount, setTransferAmount] = useState('');
  const [transferAssetId, setTransferAssetId] = useState('');
  const [destinationVaultId, setDestinationVaultId] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const fetchVaults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fireblocks-get-vaults');
      
      if (error) {
        console.error('Error fetching vaults:', error);
        toast({
          title: "Error",
          description: "Failed to fetch vaults",
          variant: "destructive",
        });
        return;
      }

      setVaults(data.accounts || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to fetch vaults",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async (vaultId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fireblocks-get-assets', {
        body: { vaultId }
      });
      
      if (error) {
        console.error('Error fetching assets:', error);
        toast({
          title: "Error",
          description: "Failed to fetch assets",
          variant: "destructive",
        });
        return;
      }

      setAssets(data.assets || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createVault = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fireblocks-create-vault', {
        body: {
          name: newVaultName,
          hiddenOnUI,
          customerRefId: customerRefId || undefined,
          autoFuel: false
        }
      });

      if (error) {
        console.error('Error creating vault:', error);
        toast({
          title: "Error",
          description: "Failed to create vault",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: `Vault "${newVaultName}" created successfully`,
      });

      setCreateVaultOpen(false);
      setNewVaultName('');
      setHiddenOnUI(false);
      setCustomerRefId('');
      await fetchVaults();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiateTransfer = async () => {
    if (!selectedVault) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fireblocks-initiate-transfer', {
        body: {
          assetId: transferAssetId,
          source: {
            type: 'VAULT_ACCOUNT',
            id: selectedVault.id
          },
          destination: {
            type: 'VAULT_ACCOUNT',
            id: destinationVaultId
          },
          amount: transferAmount,
          note: transferNote
        }
      });

      if (error) {
        console.error('Error initiating transfer:', error);
        toast({
          title: "Error",
          description: "Failed to initiate transfer",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Transfer initiated successfully",
      });

      setTransferOpen(false);
      setTransferAmount('');
      setTransferAssetId('');
      setDestinationVaultId('');
      setTransferNote('');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaults();
  }, []);

  useEffect(() => {
    if (selectedVault) {
      fetchAssets(selectedVault.id);
    }
  }, [selectedVault]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Fireblocks Vault Management</h2>
        </div>
        <Dialog open={createVaultOpen} onOpenChange={setCreateVaultOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Vault
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Vault</DialogTitle>
              <DialogDescription>
                Create a new Fireblocks vault for asset management
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="vaultName">Vault Name</Label>
                <Input
                  id="vaultName"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="Enter vault name"
                />
              </div>
              <div>
                <Label htmlFor="customerRef">Customer Reference ID (Optional)</Label>
                <Input
                  id="customerRef"
                  value={customerRefId}
                  onChange={(e) => setCustomerRefId(e.target.value)}
                  placeholder="Enter customer reference ID"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hidden"
                  checked={hiddenOnUI}
                  onChange={(e) => setHiddenOnUI(e.target.checked)}
                />
                <Label htmlFor="hidden">Hidden on UI</Label>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={createVault} disabled={loading || !newVaultName}>
                {loading ? 'Creating...' : 'Create Vault'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="vaults" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vaults" className="flex items-center gap-2">
            <Vault className="h-4 w-4" />
            Vaults
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="transfers" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transfers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vaults" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading vaults...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vaults.map((vault) => (
                <Card
                  key={vault.id}
                  className={`cursor-pointer transition-colors ${
                    selectedVault?.id === vault.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedVault(vault)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Vault className="h-5 w-5" />
                      {vault.name}
                    </CardTitle>
                    <CardDescription>Vault ID: {vault.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Assets:</span>
                        <Badge variant="secondary">{vault.assets?.length || 0}</Badge>
                      </div>
                      {vault.hiddenOnUI && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                      {vault.customerRefId && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {vault.customerRefId}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          {selectedVault ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Assets in {selectedVault.name}</h3>
                <Badge variant="outline">Vault {selectedVault.id}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                  <Card key={asset.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        {asset.id}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total:</span>
                        <span className="font-medium">{asset.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Available:</span>
                        <span className="font-medium text-green-600">{asset.available}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pending:</span>
                        <span className="font-medium text-yellow-600">{asset.pending}</span>
                      </div>
                      {parseFloat(asset.frozen) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Frozen:</span>
                          <span className="font-medium text-red-600">{asset.frozen}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Select a vault to view its assets
            </div>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Initiate Transfer</CardTitle>
              <CardDescription>
                Transfer assets between vaults
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sourceVault">Source Vault</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={selectedVault?.id || ''}
                    onChange={(e) => {
                      const vault = vaults.find(v => v.id === e.target.value);
                      setSelectedVault(vault || null);
                    }}
                  >
                    <option value="">Select source vault</option>
                    {vaults.map((vault) => (
                      <option key={vault.id} value={vault.id}>
                        {vault.name} ({vault.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="destinationVault">Destination Vault</Label>
                  <select
                    className="w-full p-2 border rounded"
                    value={destinationVaultId}
                    onChange={(e) => setDestinationVaultId(e.target.value)}
                  >
                    <option value="">Select destination vault</option>
                    {vaults.filter(v => v.id !== selectedVault?.id).map((vault) => (
                      <option key={vault.id} value={vault.id}>
                        {vault.name} ({vault.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="assetId">Asset</Label>
                  <Input
                    id="assetId"
                    value={transferAssetId}
                    onChange={(e) => setTransferAssetId(e.target.value)}
                    placeholder="e.g., BTC, ETH"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="note">Note (Optional)</Label>
                <Input
                  id="note"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Transfer note"
                />
              </div>
              <Button
                onClick={initiateTransfer}
                disabled={loading || !selectedVault || !destinationVaultId || !transferAssetId || !transferAmount}
                className="w-full"
              >
                {loading ? 'Initiating...' : 'Initiate Transfer'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VaultManager;