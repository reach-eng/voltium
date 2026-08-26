import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CalendarDays, AlertTriangle, ShieldCheck, FileText, Wrench, Shield, CheckCircle, 
  Plus, Bike, User, Ticket, Eye, Camera, MoreVertical, Edit, Search, Activity, Trash2, MapPin, SearchX, Download, ExternalLink, Key, Zap, Info, Clock, DollarSign, Wallet
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function KycActionModal({
  saving, confirmKycAction, setConfirmKycAction, kycRejectionReason, setKycRejectionReason, handleKycAction
}: any) {
  return (
        <AlertDialog
          open={!!confirmKycAction}
          onOpenChange={() => {
            setConfirmKycAction(null);
            setKycRejectionReason('');
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmKycAction?.action === 'approve'
                  ? 'Approve KYC'
                  : confirmKycAction?.action === 'info_required'
                    ? 'Request Correction'
                    : 'Reject KYC'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to{' '}
                {confirmKycAction?.action === 'info_required'
                  ? 'request corrections for'
                  : confirmKycAction?.action}{' '}
                the KYC verification for <strong>{confirmKycAction?.rider.fullName}</strong>?
                {(confirmKycAction?.action === 'reject' ||
                  confirmKycAction?.action === 'info_required') && (
                  <textarea
                    className="w-full mt-3 p-2 border rounded-lg text-sm"
                    placeholder={
                      confirmKycAction?.action === 'info_required'
                        ? 'What needs correction...'
                        : 'Rejection reason...'
                    }
                    value={kycRejectionReason}
                    onChange={(e) => setKycRejectionReason(e.target.value)}
                  />
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setConfirmKycAction(null);
                  setKycRejectionReason('');
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleKycAction}
                disabled={
                  saving ||
                  ((confirmKycAction?.action === 'reject' ||
                    confirmKycAction?.action === 'info_required') &&
                    !kycRejectionReason.trim())
                }
                className={
                  confirmKycAction?.action === 'reject'
                    ? 'bg-destructive hover:bg-destructive/90'
                    : confirmKycAction?.action === 'info_required'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : ''
                }
              >
                {confirmKycAction?.action === 'approve'
                  ? 'Approve'
                  : confirmKycAction?.action === 'info_required'
                    ? 'Request Correction'
                    : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

  );
}
