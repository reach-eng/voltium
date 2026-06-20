'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  Search,
  Eye,
  UserPlus,
  Smartphone,
  CheckCircle2,
  Ban,
  Download,
  X,
  ShieldAlert,
  ShieldX,
  Cpu,
  Edit,
  IndianRupee,
  ShieldCheck,
  Phone,
  Mail,
  Building,
  MapPin,
  CalendarDays,
  Lock,
  Zap,
  Clock,
  History,
  AlertTriangle,
  Trash2,
  User,
  Wallet,
  Unlock,
  Camera,
  Users,
  Bike,
  Calendar,
  MoreVertical,
  Loader2,
  Undo2,
  Keyboard,
} from 'lucide-react';
import { BRAND_DOMAIN } from '@/lib/branding';
import DeviceTrackingView from './DeviceTrackingView';
import { ExportButton } from '../export-button';
import { AdminErrorBoundary } from '../error-boundary';
import { logger } from '@/lib/logger';

interface Rider {
  [key: string]: any;
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
  // Return & TL Logic
  returnPending: boolean;
  tlChangeRequested: boolean;
  tlChangeReason: string | null;
  assignedTlId: string | null;
  assignedTlName: string | null;
  assignedTlPhone: string | null;
}

const STATE_FILTERS = ['ALL', 'NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED'];

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

function getKycBadge(status: string) {
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

function DetailGroup({
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

const MediaPreview = ({
  src,
  label,
  type = 'image',
  onDelete,
  selected,
  onSelect,
}: {
  src: string | null;
  label: string;
  type?: 'image' | 'video';
  onDelete?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) => {
  if (!src)
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {onSelect && (
            <Checkbox checked={selected} onCheckedChange={onSelect} className="h-3 w-3" />
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              onClick={onDelete}
              title={`Delete ${label}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="aspect-video rounded-2xl border bg-black overflow-hidden relative group shadow-sm">
        {type === 'image' ? (
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <video src={src} controls className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl h-8 text-[10px] font-bold"
            onClick={() => window.open(src, '_blank')}
          >
            View Full
          </Button>
        </div>
      </div>
    </div>
  );
};

const PAGE_SIZE = 20;

export default function RiderManagement() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState('ALL');
  const KYC_FILTERS = ['ALL', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', 'PENDING'];

  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRider, setNewRider] = useState({ phone: '', fullName: '' });
  const [addingRider, setAddingRider] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    try {
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
      if (res.ok) {
        const json = await res.json();
        setRiders(json.data?.riders || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      }
    } catch (err) {
      logger.error('Failed to fetch riders', { error: err });
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [search, stateFilter, kycFilter, page, sortKey, sortDir]);

  useEffect(() => {
    setSearching(true);
    const timer = setTimeout(() => fetchRiders(), 300);
    return () => clearTimeout(timer);
  }, [fetchRiders]);

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
        setRiders((prev) =>
          prev.map((r) => (r.id === selectedRider.id ? ({ ...r, ...editForm } as Rider) : r))
        );
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
        setRiders((prev) =>
          prev.map((r) =>
            r.id === selectedRider.id ? ({ ...r, [deleteDocKey]: null } as Rider) : r
          )
        );
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
        setRiders((prev) =>
          prev.map((r) => (r.id === selectedRider.id ? ({ ...r, ...updates } as Rider) : r))
        );
        setSelectedRider((prev) => (prev ? ({ ...prev, ...updates } as Rider) : null));
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
        setRiders((prev) =>
          prev.map((r) => (r.id === rider.id ? ({ ...r, kycStatus } as Rider) : r))
        );
        setSelectedRider((prev) => (prev ? ({ ...prev, kycStatus } as Rider) : null));
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
        setRiders(riders.filter((r) => r.id !== riderId));
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
        setRiders(riders.map((r) => (r.id === selectedRider.id ? (cleared as Rider) : r)));
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
                      `${BRAND_DOMAIN.split('.')[0]}-riders-${new Date().toISOString().split('T')[0]}.csv`
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
              onExportProgress={(p) => setExportProgress(p)}
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
                      const isRed = rider.lifecycleStatus === 'SUSPENDED' || rider.lifecycleStatus === 'CLOSED';
                      const isOrange = rider.lifecycleStatus === 'KYC_SUBMITTED' || rider.lifecycleStatus === 'PROFILE_SUBMITTED';
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
                                {new Date(rider.pickedUpAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
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
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Rider Detail Dialog */}
        <Dialog
          open={!!selectedRider}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedRider(null);
              setIsEditing(false);
            }
          }}
        >
          <DialogContent className="!max-w-[90vw] !w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl bg-background/95 backdrop-blur-xl">
            <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">
                      {selectedRider?.fullName || 'Rider Profile'}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                      {selectedRider?.riderId} · {selectedRider?.phone}
                      {selectedRider?.sharedGuarantorWith &&
                        selectedRider.sharedGuarantorWith.length > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 text-[8px] px-2 rounded-full animate-pulse"
                          >
                            Shared Backup Contact Risk
                          </Badge>
                        )}
                    </p>
                    {(selectedRider?.fatherName ||
                      selectedRider?.motherName ||
                      selectedRider?.dob) && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        {selectedRider?.fatherName && (
                          <span>
                            Father:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.fatherName}
                            </span>
                          </span>
                        )}
                        {selectedRider?.motherName && (
                          <span>
                            Mother:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.motherName}
                            </span>
                          </span>
                        )}
                        {selectedRider?.dob && (
                          <span>
                            DOB:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.dob}
                            </span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant={isEditing ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-xl h-10 px-5 gap-2 font-bold transition-all ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 border-none' : ''}`}
                    onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
                  >
                    {isEditing ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isEditing ? 'Editing Active' : 'Unlock to Edit'}
                  </Button>
                  <Badge
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-blue-500/5 border-blue-500/20 text-blue-600 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3 h-3" /> Rider Details
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
              {selectedRider && (
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList className="grid w-full grid-cols-8 mb-8 bg-muted/30 p-1 rounded-2xl h-12 sticky top-0 z-10 backdrop-blur-md">
                    <TabsTrigger
                      value="profile"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Personal Info
                    </TabsTrigger>
                    <TabsTrigger value="kyc" className="rounded-xl font-bold text-[10px] uppercase">
                      ID Photos
                    </TabsTrigger>
                    <TabsTrigger
                      value="guarantor"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Guarantor Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="inspection"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Vehicle Handover
                    </TabsTrigger>
                    <TabsTrigger
                      value="journey"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Account Steps
                    </TabsTrigger>
                    <TabsTrigger
                      value="money"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Money
                    </TabsTrigger>
                    <TabsTrigger
                      value="device"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Phone Access
                    </TabsTrigger>
                    <TabsTrigger value="ops" className="rounded-xl font-bold text-[10px] uppercase">
                      Work Details
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Profile Tab ── */}
                  <TabsContent
                    value="profile"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {/* High Priority Alerts */}
                    {(selectedRider.returnPending || selectedRider.tlChangeRequested) && (
                      <div className="space-y-3">
                        {selectedRider.returnPending && (
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                <History className="w-5 h-5 text-rose-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-rose-600">
                                  Vehicle Return Pending
                                </p>
                                <p className="text-xs text-rose-500/70">
                                  Rider has submitted photos for return approval.
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-500/20 text-rose-600 hover:bg-rose-500/10"
                            >
                              Review Photos
                            </Button>
                          </div>
                        )}
                        {selectedRider.tlChangeRequested && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                  <UserPlus className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-amber-600">
                                    TL Change Requested
                                  </p>
                                  <p className="text-xs text-amber-500/70">
                                    Reason: {selectedRider.tlChangeReason || 'No reason provided'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                                  onClick={() => handleTlAction(selectedRider.id, 'reject')}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-amber-500 hover:bg-amber-600"
                                  onClick={() => handleTlAction(selectedRider.id, 'approve')}
                                >
                                  Approve Change
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-6">
                      <DetailGroup
                        label="Full Name"
                        value={isEditing ? editForm.fullName : selectedRider.fullName}
                        isEditing={isEditing}
                        field="fullName"
                        onEdit={(v) => setEditForm({ ...editForm, fullName: v })}
                      />
                      <DetailGroup
                        label="Email Address"
                        value={isEditing ? editForm.email : selectedRider.email}
                        isEditing={isEditing}
                        field="email"
                        onEdit={(v) => setEditForm({ ...editForm, email: v })}
                      />
                      <DetailGroup
                        label="Phone Number"
                        value={isEditing ? editForm.phone : selectedRider.phone}
                        isEditing={isEditing}
                        field="phone"
                        onEdit={(v) => setEditForm({ ...editForm, phone: v })}
                      />
                      <DetailGroup
                        label="Father's Name"
                        value={isEditing ? editForm.fatherName : selectedRider.fatherName}
                        isEditing={isEditing}
                        field="fatherName"
                        onEdit={(v) => setEditForm({ ...editForm, fatherName: v })}
                      />
                      <DetailGroup
                        label="Mother's Name"
                        value={isEditing ? editForm.motherName : selectedRider.motherName}
                        isEditing={isEditing}
                        field="motherName"
                        onEdit={(v) => setEditForm({ ...editForm, motherName: v })}
                      />
                      <DetailGroup
                        label="Date of Birth"
                        value={isEditing ? editForm.dob : selectedRider.dob}
                        isEditing={isEditing}
                        field="dob"
                        type="date"
                        onEdit={(v) => setEditForm({ ...editForm, dob: v })}
                      />
                      <DetailGroup
                        label="Intent"
                        value={isEditing ? editForm.intent : selectedRider.intent}
                        isEditing={isEditing}
                        field="intent"
                        onEdit={(v) => setEditForm({ ...editForm, intent: v })}
                      />
                      <DetailGroup
                        label="Emergency Contact"
                        value={
                          isEditing ? editForm.emergencyContact : selectedRider.emergencyContact
                        }
                        isEditing={isEditing}
                        field="emergencyContact"
                        onEdit={(v) => setEditForm({ ...editForm, emergencyContact: v })}
                      />
                      <DetailGroup
                        label="Lifecycle Status"
                        value={isEditing ? editForm.lifecycleStatus : selectedRider.lifecycleStatus}
                        isEditing={isEditing}
                        field="lifecycleStatus"
                        type="select"
                        options={STATE_FILTERS}
                        onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
                      />
                    </div>

                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
                        <MapPin className="w-3 h-3" /> Current Address
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editForm.currentAddress || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, currentAddress: e.target.value })
                          }
                          className="w-full min-h-[100px] p-4 rounded-2xl border border-muted/50 bg-muted/5 text-sm focus:outline-none focus:ring-1 ring-primary/30 transition-all font-medium"
                        />
                      ) : selectedRider.currentAddress ? (
                        <p className="text-sm font-medium whitespace-pre-wrap">
                          {selectedRider.currentAddress}
                        </p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Not provided</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── KYC Media Tab ── */}
                  <TabsContent
                    value="kyc"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {selectedKycDocs.size > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                        <span className="text-xs font-medium text-destructive">
                          {selectedKycDocs.size} document(s) selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive"
                          disabled={saving}
                          onClick={handleBulkDeleteKycDocs}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Selected
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-muted/10"
                          onClick={() => setSelectedKycDocs(new Set())}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-muted/20">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`text-xs uppercase font-black tracking-widest ${getKycBadge(selectedRider.kycStatus)}`}
                        >
                          {selectedRider.kycStatus}
                        </Badge>
                        {selectedRider.kycRejectionReason && (
                          <span className="text-xs text-muted-foreground">
                            Reason: {selectedRider.kycRejectionReason}
                          </span>
                        )}
                      </div>
                      {(selectedRider.kycStatus === 'PENDING' ||
                        selectedRider.kycStatus === 'SUBMITTED' ||
                        selectedRider.kycStatus === 'INFO_REQUIRED') && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'approve' })
                            }
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'info_required' })
                            }
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" /> Needs Correction
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'reject' })
                            }
                          >
                            <ShieldX className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.profilePhoto}
                          label="Profile Photo"
                          onDelete={() => handleDeleteKycDoc('profilePhoto')}
                          selected={selectedKycDocs.has('profilePhoto')}
                          onSelect={() => toggleKycDoc('profilePhoto')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.profilePhoto || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, profilePhoto: e.target.value })
                            }
                            placeholder="Profile photo URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.signature}
                          label="Rider Signature"
                          onDelete={() => handleDeleteKycDoc('signature')}
                          selected={selectedKycDocs.has('signature')}
                          onSelect={() => toggleKycDoc('signature')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.signature || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, signature: e.target.value })
                            }
                            placeholder="Signature URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.aadhaarFront}
                          label="Aadhaar Front"
                          onDelete={() => handleDeleteKycDoc('aadhaarFront')}
                          selected={selectedKycDocs.has('aadhaarFront')}
                          onSelect={() => toggleKycDoc('aadhaarFront')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.aadhaarFront || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, aadhaarFront: e.target.value })
                            }
                            placeholder="Aadhaar front URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.aadhaarBack}
                          label="Aadhaar Back"
                          onDelete={() => handleDeleteKycDoc('aadhaarBack')}
                          selected={selectedKycDocs.has('aadhaarBack')}
                          onSelect={() => toggleKycDoc('aadhaarBack')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.aadhaarBack || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, aadhaarBack: e.target.value })
                            }
                            placeholder="Aadhaar back URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.panCard}
                          label="PAN Card"
                          onDelete={() => handleDeleteKycDoc('panCard')}
                          selected={selectedKycDocs.has('panCard')}
                          onSelect={() => toggleKycDoc('panCard')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.panCard || ''}
                            onChange={(e) => setEditForm({ ...editForm, panCard: e.target.value })}
                            placeholder="PAN card URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-3 mb-6">
                        <Building className="w-8 h-8 text-blue-600" />
                        <h4 className="text-lg font-black tracking-tight text-blue-900">
                          Bank Details
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        <DetailGroup
                          label="Bank Name"
                          value={isEditing ? editForm.bankName : selectedRider.bankName}
                          isEditing={isEditing}
                          field="bankName"
                          onEdit={(v) => setEditForm({ ...editForm, bankName: v })}
                        />
                        <DetailGroup
                          label="Account Number"
                          value={isEditing ? editForm.accountNumber : selectedRider.accountNumber}
                          isEditing={isEditing}
                          field="accountNumber"
                          onEdit={(v) => setEditForm({ ...editForm, accountNumber: v })}
                        />
                        <DetailGroup
                          label="IFSC Code"
                          value={isEditing ? editForm.ifscCode : selectedRider.ifscCode}
                          isEditing={isEditing}
                          field="ifscCode"
                          onEdit={(v) => setEditForm({ ...editForm, ifscCode: v })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Guarantor Tab ── */}
                  <TabsContent
                    value="guarantor"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {selectedRider.sharedGuarantorWith?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                        <div className="text-xs font-bold">
                          Shared Backup Contact Risk: This contact phone is also linked to:{' '}
                          {selectedRider.sharedGuarantorWith.join(', ')}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Users className="w-4 h-4" /> Personal Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <DetailGroup
                            label="Full Name"
                            value={isEditing ? editForm.guarantorName : selectedRider.guarantorName}
                            isEditing={isEditing}
                            field="guarantorName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorName: v })}
                          />
                          <DetailGroup
                            label="Phone Number"
                            value={
                              isEditing ? editForm.guarantorPhone : selectedRider.guarantorPhone
                            }
                            isEditing={isEditing}
                            field="guarantorPhone"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorPhone: v })}
                          />
                          <DetailGroup
                            label="Date of Birth"
                            value={isEditing ? editForm.guarantorDob : selectedRider.guarantorDob}
                            isEditing={isEditing}
                            field="guarantorDob"
                            type="date"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorDob: v })}
                          />
                          <DetailGroup
                            label="Father's Name"
                            value={
                              isEditing
                                ? editForm.guarantorFatherName
                                : selectedRider.guarantorFatherName
                            }
                            isEditing={isEditing}
                            field="guarantorFatherName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorFatherName: v })}
                          />
                          <DetailGroup
                            label="Mother's Name"
                            value={
                              isEditing
                                ? editForm.guarantorMotherName
                                : selectedRider.guarantorMotherName
                            }
                            isEditing={isEditing}
                            field="guarantorMotherName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorMotherName: v })}
                          />
                          <DetailGroup
                            label="Address"
                            value={
                              isEditing ? editForm.guarantorAddress : selectedRider.guarantorAddress
                            }
                            isEditing={isEditing}
                            field="guarantorAddress"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorAddress: v })}
                          />
                        </div>
                        <div className="pt-4">
                          <DetailGroup
                            label="Verification Status"
                            value={
                              isEditing ? editForm.guarantorStatus : selectedRider.guarantorStatus
                            }
                            isEditing={isEditing}
                            field="guarantorStatus"
                            type="select"
                            options={['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED']}
                            onEdit={(v) => setEditForm({ ...editForm, guarantorStatus: v })}
                          />
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Visual Verification
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <MediaPreview
                            src={selectedRider.guarantorAadhaarFront}
                            label="Aadhaar Front"
                          />
                          <MediaPreview
                            src={selectedRider.guarantorAadhaarBack}
                            label="Aadhaar Back"
                          />
                          <MediaPreview src={selectedRider.guarantorPan} label="PAN Card" />
                          <MediaPreview src={selectedRider.guarantorSignature} label="Signature" />
                          <MediaPreview
                            src={selectedRider.guarantorPhoto}
                            label="Guarantor Photo"
                          />
                        </div>
                        <MediaPreview
                          src={selectedRider.guarantorVideo}
                          label="Guarantor Video"
                          type="video"
                        />
                      </div>
                    </div>
                    {selectedRider.guarantorName && !isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-3"
                        onClick={handleClearGuarantor}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Clear Guarantor
                      </Button>
                    )}
                  </TabsContent>

                  {/* ── Pickup Inspection Tab ── */}
                  <TabsContent
                    value="inspection"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-sm font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                          <Camera className="w-5 h-5" /> Vehicle Pickup Photos
                        </h4>
                        <div className="text-[10px] font-bold uppercase text-rose-500/60 tracking-tighter">
                          Required for Post-Active State
                        </div>
                      </div>
                      {!selectedRider.pickupPhotoFront &&
                      !selectedRider.pickupPhotoBack &&
                      !selectedRider.pickupPhotoLeft &&
                      !selectedRider.pickupPhotoRight &&
                      !selectedRider.pickupPhotoWithVehicle ? (
                        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-3xl bg-background/50 text-center opacity-40">
                          <Camera className="w-10 h-10 text-rose-500 mb-4" />
                          <p className="text-sm font-black uppercase">No Pickup Photos</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Vehicle handover photos have not been uploaded yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-6">
                          <MediaPreview src={selectedRider.pickupPhotoFront} label="Front View" />
                          <MediaPreview src={selectedRider.pickupPhotoBack} label="Rear View" />
                          <MediaPreview src={selectedRider.pickupPhotoLeft} label="Left Side" />
                          <MediaPreview src={selectedRider.pickupPhotoRight} label="Right Side" />
                          <MediaPreview
                            src={selectedRider.pickupPhotoWithVehicle}
                            label="With Vehicle"
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Lifecycle Tab ── */}
                  <TabsContent
                    value="journey"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary">
                          Sign-Up Steps
                        </h4>
                        <div className="space-y-3">
                          {[
                            {
                              label: 'Registration',
                              key: 'registrationDone',
                              dateKey: 'registrationDoneAt',
                            },
                            { label: 'Deposit', key: 'depositDone', dateKey: 'depositDoneAt' },
                            { label: 'KYC', key: 'kycDone', dateKey: 'kycDoneAt' },
                            { label: 'Plan', key: 'planDone', dateKey: 'planDoneAt' },
                            { label: 'Pickup', key: 'pickupDone', dateKey: 'pickedUpAt' },
                          ].map((step) => (
                            <div
                              key={step.key}
                              className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-muted/50 group transition-all hover:bg-muted/30"
                            >
                              <div className="space-y-0.5">
                                <span className="text-xs font-black uppercase tracking-tight block">
                                  {step.label}
                                </span>
                                <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">
                                  System Flag
                                </span>
                                {selectedRider[step.key] && selectedRider[step.dateKey] && (
                                  <span className="text-[9px] text-muted-foreground/50 block mt-0.5">
                                    {new Date(selectedRider[step.dateKey]).toLocaleDateString(
                                      'en-IN',
                                      {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }
                                    )}
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <button
                                  onClick={() =>
                                    setEditForm({ ...editForm, [step.key]: !editForm[step.key] })
                                  }
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${editForm[step.key] ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}
                                >
                                  {editForm[step.key] ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <Clock className="w-3 h-3" />
                                  )}
                                  {editForm[step.key] ? 'Done' : 'Pending'}
                                </button>
                              ) : selectedRider[step.key] ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Done
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-amber-500 border-amber-500/20 w-fit gap-1 text-[10px]"
                                >
                                  <Clock className="w-3 h-3" /> Pending
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary">
                          Account Controls
                        </h4>
                        <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-8">
                          <DetailGroup
                            label="Lifecycle Status"
                            value={isEditing ? editForm.lifecycleStatus : selectedRider.lifecycleStatus}
                            isEditing={isEditing}
                            field="lifecycleStatus"
                            type="select"
                            options={['NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED']}
                            onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Finance Tab ── */}
                  <TabsContent
                    value="money"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-10 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-emerald-500/5">
                        <div className="flex items-center gap-3 mb-4 text-emerald-600">
                          <Wallet className="w-6 h-6" />
                          <Label className="text-xs font-black uppercase tracking-widest">
                            Current Wallet Balance
                          </Label>
                        </div>
                        <div className="flex items-center text-4xl font-black tracking-tighter">
                          <span className="text-emerald-500 opacity-50 mr-2">₹</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.walletBalance || 0}
                              onChange={(e) =>
                                setEditForm({ ...editForm, walletBalance: Number(e.target.value) })
                              }
                              className="bg-transparent border-none text-4xl font-black h-auto p-0 focus-visible:ring-0 w-full"
                            />
                          ) : (
                            <span>
                              {(selectedRider.walletBalance || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-10 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-500/5">
                        <div className="flex items-center gap-3 mb-4 text-blue-600">
                          <ShieldCheck className="w-6 h-6" />
                          <Label className="text-xs font-black uppercase tracking-widest">
                            Security Deposit Held
                          </Label>
                        </div>
                        <div className="flex items-center text-4xl font-black tracking-tighter">
                          <span className="text-blue-500 opacity-50 mr-2">₹</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.securityDeposit || 0}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  securityDeposit: Number(e.target.value),
                                })
                              }
                              className="bg-transparent border-none text-4xl font-black h-auto p-0 focus-visible:ring-0 w-full"
                            />
                          ) : (
                            <span>
                              {(selectedRider.securityDeposit || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 rounded-3xl bg-muted/20 border flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border shadow-sm">
                          <Calendar className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                            Deposit Payment Status
                          </p>
                          {isEditing ? (
                            <Select
                              value={editForm.depositStatus || 'PENDING'}
                              onValueChange={(v) => setEditForm({ ...editForm, depositStatus: v })}
                            >
                              <SelectTrigger className="bg-transparent border-none h-auto p-0 font-black text-lg focus:outline-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">PENDING</SelectItem>
                                <SelectItem value="PAID">PAID</SelectItem>
                                <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-black tracking-widest ${getKycBadge(selectedRider.depositStatus)}`}
                            >
                              {selectedRider.depositStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1">
                          Payment Streak
                        </p>
                        <div className="text-2xl font-black flex items-center justify-end gap-2 text-emerald-600">
                          <Zap className="w-5 h-5 fill-emerald-600" />
                          {selectedRider.paymentStreak || 0}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Device Tab ── */}
                  <TabsContent
                    value="device"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {/* Permission Matrix */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Phone Permissions
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {permissions.map((perm) => (
                          <div
                            key={perm.key}
                            className="flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/5"
                          >
                            <span className="text-[10px] font-bold uppercase text-muted-foreground/60">
                              {perm.label}
                            </span>
                            <div className="flex items-center justify-between">
                              {selectedRider[perm.key] ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Granted
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-rose-400 border-rose-400/20 w-fit gap-1 text-[10px]"
                                >
                                  <ShieldAlert className="w-3 h-3" /> Required
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DeviceTrackingView riderId={selectedRider.id} />
                  </TabsContent>

                  {/* ── Ops Tab ── */}
                  <TabsContent
                    value="ops"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4" /> Hierarchy & Support
                        </h4>
                        <div className="space-y-4">
                          <DetailGroup
                            label="Assigned Team Leader"
                            value={isEditing ? editForm.teamLeader : selectedRider.teamLeader}
                            isEditing={isEditing}
                            field="teamLeader"
                            onEdit={(v) => setEditForm({ ...editForm, teamLeader: v })}
                          />
                          <DetailGroup
                            label="Assigned TL Name"
                            value={
                              isEditing ? editForm.assignedTlName : selectedRider.assignedTlName
                            }
                            isEditing={isEditing}
                            field="assignedTlName"
                            onEdit={(v) => setEditForm({ ...editForm, assignedTlName: v })}
                          />
                          <DetailGroup
                            label="Assigned TL Phone"
                            value={
                              isEditing ? editForm.assignedTlPhone : selectedRider.assignedTlPhone
                            }
                            isEditing={isEditing}
                            field="assignedTlPhone"
                            onEdit={(v) => setEditForm({ ...editForm, assignedTlPhone: v })}
                          />
                          <DetailGroup
                            label="Emergency Contact"
                            value={
                              isEditing ? editForm.emergencyContact : selectedRider.emergencyContact
                            }
                            isEditing={isEditing}
                            field="emergencyContact"
                            onEdit={(v) => setEditForm({ ...editForm, emergencyContact: v })}
                          />
                          <DetailGroup
                            label="Referred By"
                            value={isEditing ? editForm.referredBy : selectedRider.referredBy}
                            isEditing={isEditing}
                            field="referredBy"
                            onEdit={(v) => setEditForm({ ...editForm, referredBy: v })}
                          />
                        </div>
                      </div>
                      <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Bike className="w-4 h-4" /> Hub Operations
                        </h4>
                        <div className="space-y-4">
                          <DetailGroup
                            label="Preferred Pickup Hub"
                            value={isEditing ? editForm.pickupHub : selectedRider.pickupHub}
                            isEditing={isEditing}
                            field="pickupHub"
                            onEdit={(v) => setEditForm({ ...editForm, pickupHub: v })}
                          />
                          <DetailGroup
                            label="Work Shift Preference"
                            value={
                              isEditing ? editForm.preferredShift : selectedRider.preferredShift
                            }
                            isEditing={isEditing}
                            field="preferredShift"
                            onEdit={(v) => setEditForm({ ...editForm, preferredShift: v })}
                          />
                          <DetailGroup
                            label="Delivery Partner ID"
                            value={isEditing ? editForm.deliveryId : selectedRider.deliveryId}
                            isEditing={isEditing}
                            field="deliveryId"
                            onEdit={(v) => setEditForm({ ...editForm, deliveryId: v })}
                          />
                          <DetailGroup
                            label="User Intent"
                            value={isEditing ? editForm.intent : selectedRider.intent}
                            isEditing={isEditing}
                            field="intent"
                            onEdit={(v) => setEditForm({ ...editForm, intent: v })}
                          />
                          <DetailGroup
                            label="Active Vehicle"
                            value={isEditing ? editForm.activeVehicle : selectedRider.activeVehicle}
                            isEditing={isEditing}
                            field="activeVehicle"
                            onEdit={(v) => setEditForm({ ...editForm, activeVehicle: v })}
                          />
                          <DetailGroup
                            label="Vehicle Model"
                            value={
                              isEditing
                                ? editForm.activeVehicleModel
                                : selectedRider.activeVehicleModel
                            }
                            isEditing={isEditing}
                            field="activeVehicleModel"
                            onEdit={(v) => setEditForm({ ...editForm, activeVehicleModel: v })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            <DialogFooter className="px-8 py-6 bg-muted/20 border-t flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-2">
                {isEditing ? (
                  <Unlock className="w-3 h-3 text-amber-500" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                {isEditing ? 'Editing Active' : 'View Only'}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRider(null);
                    setIsEditing(false);
                  }}
                  className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] tracking-widest"
                >
                  Close
                </Button>
                {isEditing && (
                  <Button
                    onClick={handleUpdateRider}
                    disabled={saving}
                    className="rounded-xl h-11 px-10 font-black uppercase text-[10px] tracking-widest bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-105"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Rider Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Rider</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Rider name"
                  value={newRider.fullName}
                  onChange={(e) => setNewRider((p) => ({ ...p, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number (10 digits)</Label>
                <Input
                  placeholder="9876543210"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={newRider.phone}
                  onChange={(e) =>
                    setNewRider((p) => ({
                      ...p,
                      phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRider} disabled={addingRider || newRider.phone.length < 10}>
                {addingRider ? 'Creating...' : 'Add Rider'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the rider profile and
                remove their data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmDelete && handleDeleteRider(confirmDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Rider
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* KYC Action Confirmation Dialog */}
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

        {/* Delete KYC Document Confirmation */}
        <AlertDialog open={!!deleteDocKey} onOpenChange={() => setDeleteDocKey(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this <strong>{deleteDocKey}</strong> document? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDocKey(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteKycDoc}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear Guarantor Confirmation */}
        <AlertDialog open={confirmClearGuarantor} onOpenChange={setConfirmClearGuarantor}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Guarantor</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to clear all guarantor information for this rider? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmClearGuarantor(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmClearGuarantorAction}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear Guarantor
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedIds.size} Rider{selectedIds.size !== 1 ? 's' : ''}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the selected rider
                {selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setBulkDeleteOpen(false);
                  handleBulkAction('delete');
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
