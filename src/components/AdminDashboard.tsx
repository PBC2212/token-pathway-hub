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
  pledge_id: number;
  user_address: string;
  asset_type: string;
  appraised_value: number;
  token_symbol: string;
  contract_address: string;
  description: string;
  document_hash: string;
  appraisal_date: string;
  appraiser_license?: string;
  status: 'pending' | 'approved' | 'rejected' | 'tokens_minted' | 'defaulted';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  token_amount?: number;
  nft_token_id?: number;
}

interface BlockchainTransaction {
  id: string;
  transaction_id: string;
  transaction_type: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  transaction_data: any;
}

const AdminDashboard = ()