'use client';

import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Eye,
  UserPlus,
  CheckCircle2,
  Ban,
  Download,
  X,
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Bike,
  Loader2,
  Undo2,
  Keyboard,
} from 'lucide-react';
import { BRAND_DOMAIN } from '@/lib/branding';
import { ExportButton } from '../../export-button';
import { AdminErrorBoundary } from '../../error-boundary';
import { logger } from '@/lib/logger';

interface Rider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  kycStatus: string;
  state: string;
  lifecycleStatus: string;
  walletBalance: number;
  securityDeposit: number;
  depositStatus: string;
  rentalStatus: string;
  currentPlan: string | null;
  planStatus: string;
  vehicleId: string | null;
  pickupHub: string | null;
  referralCode: string;
  fatherName: string | null;
  motherName: string | null;
  dob: string | null;
  currentAddress: string | null;

  emergencyContact: string | null;
  intent: string | null;
  accountStatus: string;
  locationGranted: boolean;
  batteryGranted: boolean;
  contactsGranted: boolean;
  callLogsGranted: boolean;
  micGranted: boolean;
  cameraGranted: boolean;
  phoneGranted: boolean;
  guarantorName: string | null;
  guarantorRelation: string | null;
  guarantorPhone: string | null;
  guarantorDob: string | null;
  guarantorStatus: string;
  guarantorAadhaarFront: string | null;
  guarantorAadhaarBack: string | null;
  guarantorPan: string | null;
  guarantorVideo: string | null;
  guarantorSignature: string | null;
  guarantorFatherName: string | null;
  guarantorMotherName: string | null;
  guarantorAddress: string | null;
  guarantorPhoto: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  createdAt: string;
  // Operational extras from current
  profilePhoto: string | null;
  riderPhoto: string | null;
  signature: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  panCard: string | null;
  aadhaarNumber: string | null;
  panNumber: string | null;
  paymentStreak: number;
  sharedGuarantorWith: string[];
  activeVehicle: string | null;
  activeVehicleModel: string | null;
  joiningDate: string | null;
  submissionDate: string | null;
  scooterSubmissionDate: string | null;
  preferredShift: string | null;
  referredBy: string | null;
  teamLeader: string | null;
  pickupPhotoFront: string | null;
  pickupPhotoBack: string | null;
  pickupPhotoLeft: string | null;
  pickupPhotoRight: string | null;
  pickupPhotoWithVehicle: string | null;
  deliveryId: string | null;
  pickedUpAt: string | null;
  // Return & TL Logic
  returnPending: boolean;
  tlChangeRequested: boolean;
  tlChangeReason: string | null;
  assignedTlId: string | null;
  assignedTlName: string | null;
  assignedTlPhone: string | null;
}

export const STATE_FILTERS = ['ALL', 'NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED'];

function getStateBadge(state: string) {
  const styles: Record<string, string> = {
    APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    POST_ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PRE_ACTIVE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    SUSPENDED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    ONBOARDING: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  };
  return styles[state] || 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
}

export function getKycBadge(status: string) {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'REJECTED':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    case 'INFO_REQUIRED':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'PENDING':
    case 'SUBMITTED':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

const permissions = [
  { key: 'locationGranted', label: 'Location' },
  { key: 'batteryGranted', label: 'Battery' },
  { key: 'contactsGranted', label: 'Contacts' },
  { key: 'callLogsGranted', label: 'Call Logs' },
  { key: 'micGranted', label: 'Microphone' },
  { key: 'cameraGranted', label: 'Camera' },
  { key: 'phoneGranted', label: 'Phone' },
] as const;

interface DetailGroupProps {
  label: string;
  value: any;
  isEditing?: boolean;
  field?: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  onEdit?: (val: string) => void;
}

export function DetailGroup({
  label,
  value,
  isEditing,
  options,
  onEdit,
  type = 'text',
}: DetailGroupProps) {
  return (
    <div className="space-y-1.5 flex-1">
      <p className="text-[10px] items-center font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
        {label}
      </p>
      {isEditing && onEdit ? (
        type === 'select' && options ? (
          <select
            value={value}
            onChange={(e) => onEdit(e.target.value)}
            className="w-full bg-background border border-border/50 rounded-lg h-9 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o.replace('_', ' ')}
              </option>
            ))}
          </select>
        ) : (
          <Input
            type={type}
            value={value || ''}
            onChange={(e) => onEdit(e.target.value)}
            className="h-9 text-sm bg-background border-border/50 focus:border-primary/50 transition-all"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        )
      ) : (
        <p title={value} className="text-sm font-semibold text-foreground truncate min-h-[1.25rem]">
          {value || (
            <span className="text-muted-foreground/30 font-normal italic">Not provided</span>
          )}
        </p>
      )}
    </div>
  );
}



const PAGE_SIZE = 20;


import { RiderDetailModal } from './RiderDetailModal';
import { AddRiderModal } from './AddRiderModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { KycActionModal } from './KycActionModal';
import { DeleteDocModal } from './DeleteDocModal';
import { ClearGuarantorModal } from './ClearGuarantorModal';
import { BulkDeleteModal } from './BulkDeleteModal';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
export default function RiderManagement() {
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [stateFilter, setStateFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const KYC_FILTERS = ['ALL', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', 'PENDING'];

  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRider, setNewRider] = useState({ phone: '', fullName: '' });
  const [addingRider, setAddingRider] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ [key: string]: any }>({});
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [selectedKycDocs, setSelectedKycDocs] = useState<Set<string>>(new Set());
  const [confirmKycAction, setConfirmKycAction] = useState<{
    rider: Rider;
    action: 'approve' | 'reject' | 'info_required';
  } | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState('');
  const [deleteDocKey, setDeleteDocKey] = useState<string | null>(null);
  const [confirmClearGuarantor, setConfirmClearGuarantor] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const componentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const {
    data: ridersData,
    isLoading: loading,
    refetch: fetchRiders,
  } = useQuery({
    queryKey: ['adminRiders', search, stateFilter, kycFilter, page, sortKey, sortDir, PAGE_SIZE],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stateFilter !== 'ALL') params.set('state', stateFilter);
      if (kycFilter !== 'ALL') params.set('kycStatus', kycFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(page));
      if (sortKey) {
        params.set('sortBy', sortKey);
        params.set('sortDir', sortDir);
      }

      const res = await fetch(`/api/admin/riders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch riders');
      return res.json();
    },
    staleTime: 30000,
  });

  const riders: Rider[] = ridersData?.data?.riders || [];
  const total = ridersData?.pagination?.total || 0;
  const totalPages = ridersData?.pagination?.totalPages || 1;

  useEffect(() => {
    if (search) setSearching(true);
    const timer = setTimeout(() => {
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, stateFilter, kycFilter, sortKey, sortDir]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(riders.map((r) => r.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) {
          handleBulkAction('updateStatus', 'POST_ACTIVE');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) {
          handleBulkAction('updateStatus', 'SUSPENDED');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, bulkLoading, lastAction, riders]);

  async function handleBulkAction(action: string, value?: string) {
    if (selectedIds.size === 0) return;
    const previousStates: Record<string, any> = {};
    riders
      .filter((r) => selectedIds.has(r.id))
      .forEach((r) => {
        previousStates[r.id] = { state: r.state, accountStatus: r.accountStatus };
      });

    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/riders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
      });
      if (res.ok) {
        setLastAction({
          ids: Array.from(selectedIds),
          previousStates,
          action: value || action,
        });
        setShowUndoToast(true);
        setTimeout(() => setShowUndoToast(false), 5000);
        setSelectedIds(new Set());
        fetchRiders();
      }
    } catch (err) {
      logger.error('Bulk action failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleUndo() {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = Object.entries(lastAction.previousStates).map(([id, prev]) =>
        fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, state: prev.state, accountStatus: prev.accountStatus }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      fetchRiders();
    } catch (err) {
      logger.error('Undo failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleAddRider() {
    if (!newRider.phone || newRider.phone.length < 10) return;
    setAddingRider(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + newRider.phone, fullName: newRider.fullName || '' }),
      });
      if (res.ok) {
        setShowAddDialog(false);
        setNewRider({ phone: '', fullName: '' });
        fetchRiders();
      }
    } catch (err) {
      logger.error('Failed to add rider', { error: err });
    } finally {
      setAddingRider(false);
    }
  }

  async function handleUpdateRider() {
    if (!selectedRider) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, ...editForm }),
      });
      if (res.ok) {
        fetchRiders();
        setSelectedRider((prev) => (prev ? ({ ...prev, ...editForm } as Rider) : null));
        setIsEditing(false);
      }
    } catch (err) {
      logger.error('Failed to update rider', { error: err });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteKycDoc(docKey: string) {
    if (!selectedRider) return;
    setDeleteDocKey(docKey);
  }

  async function confirmDeleteKycDoc() {
    if (!selectedRider || !deleteDocKey) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, [deleteDocKey]: null }),
      });
      if (res.ok) {
        fetchRiders();
        setSelectedRider((prev) => (prev ? ({ ...prev, [deleteDocKey]: null } as Rider) : null));
      }
    } catch (err) {
      logger.error('Failed to delete KYC document', { error: err });
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkDeleteKycDocs() {
    if (!selectedRider || selectedKycDocs.size === 0) return;
    setSaving(true);
    try {
      const updates = Object.fromEntries(Array.from(selectedKycDocs).map((k) => [k, null]));
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedRider.id, ...updates }),
      });
      if (res.ok) {
        fetchRiders();setSelectedRider((prev) => (prev ? ({ ...prev, ...updates } as Rider) : null));
        setSelectedKycDocs(new Set());
      }
    } catch (err) {
      logger.error('Failed to bulk delete KYC documents', { error: err });
    } finally {
      setSaving(false);
    }
  }

  async function handleKycAction() {
    if (!confirmKycAction) return;
    const { rider, action } = confirmKycAction;
    const statusMap = { approve: 'APPROVED', reject: 'REJECTED', info_required: 'INFO_REQUIRED' };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          kycStatus: statusMap[action],
          rejectionReason:
            action === 'reject' || action === 'info_required' ? kycRejectionReason : undefined,
        }),
      });
      if (res.ok) {
        const kycStatus = statusMap[action];
        fetchRiders();setSelectedRider((prev) => (prev ? ({ ...prev, kycStatus } as Rider) : null));
        setConfirmKycAction(null);
        setKycRejectionReason('');
      }
    } catch (err) {
      logger.error('Failed to update KYC', { error: err });
    } finally {
      setSaving(false);
    }
  }

  function toggleKycDoc(docKey: string) {
    const n = new Set(selectedKycDocs);
    if (n.has(docKey)) {
      n.delete(docKey);
    } else {
      n.add(docKey);
    }
    setSelectedKycDocs(n);
  }

  async function handleDeleteRider(riderId: string) {
    if (confirmDelete !== riderId) {
      setConfirmDelete(riderId);
      return;
    }
    try {
      const res = await fetch(`/api/admin/riders?id=${riderId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRiders();
        if (selectedRider?.id === riderId) setSelectedRider(null);
      }
    } catch (err) {
      logger.error('Delete failed', { error: err });
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleTlAction(riderId: string, action: 'approve' | 'reject') {
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: riderId, tlAction: action }),
      });
      if (res.ok) {
        fetchRiders();
        if (selectedRider?.id === riderId) {
          const json = await res.json();
          setSelectedRider(json.data);
        }
      }
    } catch (err) {
      logger.error('Failed to process TL action', { error: err });
    }
  }

  async function handleClearGuarantor() {
    if (!selectedRider) return;
    setConfirmClearGuarantor(true);
  }

  async function confirmClearGuarantorAction() {
    if (!selectedRider) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRider.id,
          guarantorName: null,
          guarantorRelation: null,
          guarantorPhone: null,
          guarantorDob: null,
          guarantorStatus: null,
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null,
          guarantorPan: null,
          guarantorVideo: null,
          guarantorSignature: null,
        }),
      });
      if (res.ok) {
        const cleared = {
          ...selectedRider,
          guarantorName: null,
          guarantorRelation: null,
          guarantorPhone: null,
          guarantorDob: null,
          guarantorStatus: '',
          guarantorAadhaarFront: null,
          guarantorAadhaarBack: null,
          guarantorPan: null,
          guarantorVideo: null,
          guarantorSignature: null,
        };
        setSelectedRider(cleared as Rider);
        fetchRiders();
      }
    } catch (err) {
      logger.error('Failed to clear guarantor', { error: err });
    } finally {
      setSaving(false);
      setConfirmClearGuarantor(false);
    }
  }

  function startEditing() {
    if (!selectedRider) return;
    setEditForm({ ...selectedRider });
    setIsEditing(true);
  }

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, rider ID, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-background border-muted-foreground/20 focus:border-primary"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
                <span className="text-xs px-2 font-medium text-primary">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction('updateStatus', 'POST_ACTIVE')}
                  title="Approve (Ctrl+K)"
                >
                  {bulkLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}{' '}
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                  disabled={bulkLoading}
                  onClick={() => handleBulkAction('updateStatus', 'SUSPENDED')}
                  title="Suspend (Ctrl+R)"
                >
                  {bulkLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Ban className="w-3 h-3 mr-1" />
                  )}{' '}
                  Suspend
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                  disabled={bulkLoading}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-muted-foreground/10 transition-all duration-200"
                  onClick={() => {
                    const header = 'Rider ID,Name,Phone,State,KYC Status';
                    const rows = riders
                      .filter((r) => selectedIds.has(r.id))
                      .map((r) =>
                        [r.riderId, `"${r.fullName || ''}"`, r.phone, r.state, r.kycStatus].join(
                          ','
                        )
                      );
                    const csv = [header, ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute(
                      'download',
                      `${BRAND_DOMAIN.split('.')[0]}-riders-${formatDateDDMMYYYY(new Date())}.csv`
                    );
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-3 h-3 mr-1" /> Export
                </Button>
                {lastAction && (
                  <>
                    <div className="w-px h-4 bg-border/50 mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                      disabled={bulkLoading}
                      onClick={handleUndo}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo2 className="w-3 h-3 mr-1" /> Undo
                    </Button>
                  </>
                )}
                <div className="w-px h-4 bg-border/50 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
                  onClick={() => setSelectedIds(new Set())}
                  title="Clear selection"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-10 px-4"
              onClick={() => setShowAddDialog(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" /> Add Rider
            </Button>
            {exportProgress !== null && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-primary">Exporting... {exportProgress}%</span>
                <Progress value={exportProgress} className="w-16 h-1" />
              </div>
            )}
            <ExportButton
              data={riders.map((r) => ({
                riderId: r.riderId,
                name: r.fullName || 'Unknown',
                phone: r.phone,
                email: r.email,
                state: r.state,
                kycStatus: r.kycStatus,
                walletBalance: r.walletBalance,
                securityDeposit: r.securityDeposit,
                depositStatus: r.depositStatus,
                guarantorName: r.guarantorName,
                guarantorPhone: r.guarantorPhone,
                createdAt: r.createdAt,
              }))}
              filename="riders"
              columns={[
                { key: 'riderId', label: 'Rider ID' },
                { key: 'name', label: 'Name' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'state', label: 'State' },
                { key: 'kycStatus', label: 'KYC Status' },
                { key: 'walletBalance', label: 'Wallet Balance' },
                { key: 'securityDeposit', label: 'Security Deposit' },
                { key: 'depositStatus', label: 'Deposit Status' },
                { key: 'guarantorName', label: 'Guarantor Name' },
                { key: 'guarantorPhone', label: 'Guarantor Phone' },
                { key: 'createdAt', label: 'Created At' },
              ]}
              onExportStart={() => setExportProgress(0)}
              onExportProgress={(p: any) => setExportProgress(p)}
              onExportComplete={() => setExportProgress(null)}
            />
          </div>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Keyboard className="w-3 h-3" />
          <span>Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Suspend · Ctrl+Z Undo</span>
        </div>

        {/* State Filter Tabs */}
        <Tabs value={stateFilter} onValueChange={setStateFilter}>
          <TabsList className="bg-muted/30 p-1 rounded-xl">
            {STATE_FILTERS.map((s) => (
              <TabsTrigger
                key={s}
                value={s}
                className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
              >
                {s.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* KYC Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
            KYC:
          </span>
          {KYC_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setKycFilter(s)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${
                kycFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Riders Table */}
        <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-muted/30">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === riders.length && riders.length > 0}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? new Set(riders.map((r) => r.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => {
                        if (sortKey === 'fullName')
                          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else {
                          setSortKey('fullName');
                          setSortDir('asc');
                        }
                      }}
                    >
                      Name {sortKey === 'fullName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => {
                        if (sortKey === 'phone') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                        else {
                          setSortKey('phone');
                          setSortDir('asc');
                        }
                      }}
                    >
                      Phone {sortKey === 'phone' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Pickup Date</TableHead>
                    <TableHead>ID Check</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead className="text-right w-[120px]">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                          <AlertTriangle className="w-8 h-8 opacity-20" />
                          <p>No riders found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    riders.map((rider) => {
                      const isActive = rider.lifecycleStatus === 'ACTIVE';
                      const isRed =
                        rider.lifecycleStatus === 'SUSPENDED' || rider.lifecycleStatus === 'CLOSED';
                      const isOrange =
                        rider.lifecycleStatus === 'KYC_SUBMITTED' ||
                        rider.lifecycleStatus === 'PROFILE_SUBMITTED';
                      const nameColor = isRed
                        ? 'text-rose-600'
                        : isActive
                          ? 'text-emerald-600'
                          : isOrange
                            ? 'text-orange-500'
                            : 'text-foreground';
                      return (
                        <TableRow
                          key={rider.id}
                          className={`hover:bg-muted/30 transition-colors group ${selectedIds.has(rider.id) ? 'bg-primary/5' : ''}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(rider.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                if (checked) next.add(rider.id);
                                else next.delete(rider.id);
                                setSelectedIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className={`font-semibold flex items-center gap-2 ${nameColor}`}>
                                {rider.fullName || '—'}
                                {rider.sharedGuarantorWith?.length > 0 && (
                                  <span title="Shared guarantor detected">
                                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                                  </span>
                                )}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{rider.phone}</TableCell>
                          <TableCell className="text-xs font-medium">
                            {rider.activeVehicle ? (
                              <span className="text-blue-600 flex items-center gap-1">
                                <Bike className="w-3 h-3" /> {rider.activeVehicle}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {rider.pickedUpAt ? (
                              <span className="text-emerald-600 font-medium">
                                {formatDateDDMMYYYY(rider.pickedUpAt)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Pending</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-black tracking-widest ${getKycBadge(rider.kycStatus)}`}
                            >
                              {rider.kycStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-sm">
                            ₹{(rider.walletBalance || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg bg-blue-500/5 hover:bg-blue-500/10"
                                onClick={() => setSelectedRider(rider)}
                                title="View Details"
                              >
                                <Eye className="w-4 h-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => handleDeleteRider(rider.id)}
                                title="Remove Rider"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p: any) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p: any) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Rider Detail Dialog */}
        <RiderDetailModal 
          selectedRider={selectedRider}
          setSelectedRider={setSelectedRider}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          editForm={editForm}
          setEditForm={setEditForm}
          saving={saving}
          selectedKycDocs={selectedKycDocs}
          setSelectedKycDocs={setSelectedKycDocs}
          setConfirmKycAction={setConfirmKycAction}
          kycRejectionReason={kycRejectionReason}
          handleUpdateRider={handleUpdateRider}
          handleDeleteKycDoc={handleDeleteKycDoc}
          handleBulkDeleteKycDocs={handleBulkDeleteKycDocs}
          toggleKycDoc={toggleKycDoc}
          handleTlAction={handleTlAction}
          handleClearGuarantor={handleClearGuarantor}
          startEditing={startEditing}
        />

        {/* Add Rider Dialog */}
        <AddRiderModal 
          showAddDialog={showAddDialog}
          setShowAddDialog={setShowAddDialog}
          newRider={newRider}
          setNewRider={setNewRider}
          addingRider={addingRider}
          handleAddRider={handleAddRider}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDeleteModal 
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          handleDeleteRider={handleDeleteRider}
        />

        {/* KYC Action Confirmation Dialog */}
        <KycActionModal 
          saving={saving}
          confirmKycAction={confirmKycAction}
          setConfirmKycAction={setConfirmKycAction}
          kycRejectionReason={kycRejectionReason}
          setKycRejectionReason={setKycRejectionReason}
          handleKycAction={handleKycAction}
        />

        {/* Delete KYC Document Confirmation */}
        <DeleteDocModal 
          deleteDocKey={deleteDocKey}
          setDeleteDocKey={setDeleteDocKey}
          confirmDeleteKycDoc={confirmDeleteKycDoc}
        />

        {/* Clear Guarantor Confirmation */}
        <ClearGuarantorModal 
          confirmClearGuarantor={confirmClearGuarantor}
          setConfirmClearGuarantor={setConfirmClearGuarantor}
          confirmClearGuarantorAction={confirmClearGuarantorAction}
        />

        {/* Bulk Delete Confirmation */}
        <BulkDeleteModal 
          bulkDeleteOpen={bulkDeleteOpen}
          setBulkDeleteOpen={setBulkDeleteOpen}
          selectedIds={selectedIds}
          handleBulkAction={handleBulkAction}
        />

        {/* Undo Toast */}
        {showUndoToast && lastAction && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
            <span className="text-sm">
              {lastAction.ids.length} rider(s) updated to {lastAction.action}
            </span>
            <Button size="sm" variant="secondary" onClick={handleUndo} className="h-7 text-xs">
              <Undo2 className="w-3 h-3 mr-1" /> Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUndoToast(false)}
              className="h-7 w-7 p-0 text-background/60 hover:text-background"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </AdminErrorBoundary>
  );
}
