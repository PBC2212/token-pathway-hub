import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  Shield, 
  Eye, 
  Edit, 
  Trash2, 
  AlertTriangle,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  admin_role: string;
  action: string;
  table_name: string;
  record_id?: string;
  accessed_data?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

const AuditLogsViewer = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchAuditLogs = async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;
      
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: {
          operation: 'get_audit_logs',
          limit: 50,
          offset: currentPage * 50
        }
      });

      if (error) {
        console.error('Error fetching audit logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch audit logs',
          variant: 'destructive'
        });
        return;
      }

      const logs = data?.data?.auditLogs || [];
      
      if (reset) {
        setAuditLogs(logs);
        setPage(0);
      } else {
        setAuditLogs(prev => [...prev, ...logs]);
      }
      
      setHasMore(logs.length === 50);
      if (!reset) setPage(currentPage + 1);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view_pledges_admin':
      case 'direct_select':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'update':
      case 'update_status':
        return <Edit className="h-4 w-4 text-orange-500" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'suspicious_activity_detected':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    const isSuspicious = action.toLowerCase().includes('suspicious');
    const isDelete = action.toLowerCase().includes('delete');
    const isUpdate = action.toLowerCase().includes('update');
    
    if (isSuspicious) {
      return <Badge variant="destructive">{action}</Badge>;
    } else if (isDelete) {
      return <Badge variant="destructive" className="bg-red-100 text-red-700">{action}</Badge>;
    } else if (isUpdate) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700">{action}</Badge>;
    } else {
      return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatUserId = (userId: string) => {
    return `${userId.slice(0, 8)}...${userId.slice(-8)}`;
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = !actionFilter || log.action.toLowerCase().includes(actionFilter.toLowerCase());
    
    return matchesSearch && matchesAction;
  });

  useEffect(() => {
    fetchAuditLogs(true);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Audit Logs</h2>
        </div>
        <Button onClick={() => fetchAuditLogs(true)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search actions, tables, or user IDs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="action-filter">Action Filter</Label>
              <Input
                id="action-filter"
                placeholder="Filter by action type..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{filteredLogs.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">View Actions</p>
                <p className="text-2xl font-bold">
                  {filteredLogs.filter(log => log.action.toLowerCase().includes('view') || log.action.toLowerCase().includes('select')).length}
                </p>
              </div>
              <Eye className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Update Actions</p>
                <p className="text-2xl font-bold">
                  {filteredLogs.filter(log => log.action.toLowerCase().includes('update')).length}
                </p>
              </div>
              <Edit className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious Activity</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredLogs.filter(log => log.action.toLowerCase().includes('suspicious')).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Logs List */}
      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <Card key={log.id} className={log.action.toLowerCase().includes('suspicious') ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getActionIcon(log.action)}
                  {getActionBadge(log.action)}
                </div>
                <span className="text-sm text-muted-foreground">{formatDate(log.created_at)}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">User ID</Label>
                  <p className="font-mono">{formatUserId(log.user_id)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Table</Label>
                  <p className="font-semibold">{log.table_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Admin Role</Label>
                  <p>{log.admin_role || 'admin'}</p>
                </div>
              </div>

              {log.record_id && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Record ID</Label>
                  <p className="font-mono text-sm">{log.record_id}</p>
                </div>
              )}

              {log.accessed_data && (
                <div className="mt-2">
                  <Label className="text-xs text-muted-foreground">Data Accessed</Label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.accessed_data, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredLogs.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            No audit logs found
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center">
            <Button onClick={() => fetchAuditLogs(false)} variant="outline">
              Load More Logs
            </Button>
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin inline-block h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading audit logs...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsViewer;