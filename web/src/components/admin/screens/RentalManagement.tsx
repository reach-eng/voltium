'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
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
import {
  CalendarDays,
  Plus,
  Edit,
  Clock,
  IndianRupee,
  History,
  Camera,
  Search,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface RentalPlan {
  id: string;
  name: string;
  type: string;
  price: number;
  durationDays: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ActiveRental {
  id: string;
  riderId: string;
  fullName: string | null;
  name: string | null;
  phone: string;
  rentalStatus: string;
  currentPlan: string | null;
  assignedVehicle: string | null;
  vehicleId: string | null;
  returnPending?: boolean;
  submissionDate?: string | null;
  scooterSubmissionDate?: string | null;
  photoFront?: string | null;
  photoBack?: string | null;
  photoLeft?: string | null;
  photoRight?: string | null;
  photoSpeedometer?: string | null;
}

const typeColors: Record<string, string> = {
  DAILY: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  WEEKLY: 'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
  MONTHLY: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
};

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RentalManagement() {
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDialog, setPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RentalPlan | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ActiveRental | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'DAILY',
    price: '',
    durationDays: '',
    description: '',
    isActive: true,
  });
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [rentalSearch, setRentalSearch] = useState('');
  const [rentalFilter, setRentalFilter] = useState('ALL');
  const [planSearch, setPlanSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState<ActiveRental | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, rentalsRes] = await Promise.all([
        fetch('/api/admin/plans'),
        fetch('/api/admin/riders?limit=500'),
      ]);

      if (plansRes.ok) {
        const plansJson = await plansRes.json();
        setPlans(plansJson.data || []);
      }
      if (rentalsRes.ok) {
        const rentalsJson = await rentalsRes.json();
        const allRiders = rentalsJson.data?.riders || [];
        const active = allRiders.filter(
          (r: ActiveRental) => r.rentalStatus === 'ACTIVE' && !r.returnPending
        );
        const pending = allRiders.filter((r: ActiveRental) => r.returnPending === true);
        setActiveRentals(active);
        setPendingReturns(pending);
      }
    } catch (err) {
      logger.error('Failed to fetch rental data', { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleApproveReturn(riderId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: riderId,
          returnPending: false,
          rentalStatus: 'RETURNED',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to approve return');
        return;
      }
      toast.success('Return approved');
      setConfirmApprove(null);
      setSelectedReturn(null);
      fetchPlans();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(plan: RentalPlan) {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      type: plan.type,
      price: String(plan.price),
      durationDays: String(plan.durationDays),
      description: plan.description || '',
      isActive: plan.isActive,
    });
    setPlanDialog(true);
  }

  function openCreate() {
    setEditingPlan(null);
    setForm({
      name: '',
      type: 'DAILY',
      price: '',
      durationDays: '',
      description: '',
      isActive: true,
    });
    setPlanDialog(true);
  }

  async function handleSavePlan() {
    if (!form.name || !form.price || !form.durationDays) return;
    setSaving(true);
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const body = editingPlan
        ? {
            id: editingPlan.id,
            ...form,
            price: Number(form.price),
            durationDays: Number(form.durationDays),
          }
        : { ...form, price: Number(form.price), durationDays: Number(form.durationDays) };

      const res = await fetch('/api/admin/plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to save plan');
        return;
      }
      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
      setPlanDialog(false);
      fetchPlans();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePlanActive(plan: RentalPlan) {
    setToggleLoading(plan.id);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to toggle plan');
        return;
      }
      toast.success(plan.isActive ? 'Plan deactivated' : 'Plan activated');
      fetchPlans();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setToggleLoading(null);
    }
  }

  async function handleDeletePlan() {
    if (!deletePlanId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletePlanId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to delete plan');
        return;
      }
      toast.success('Plan deleted');
      setDeletePlanId(null);
      fetchPlans();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Filtered active rentals
  const filteredRentals = activeRentals.filter((r) => {
    if (rentalFilter !== 'ALL' && r.currentPlan !== rentalFilter) return false;
    if (rentalSearch) {
      const q = rentalSearch.toLocaleLowerCase('en');
      if (
        !(r.fullName || r.name || '').toLocaleLowerCase('en').includes(q) &&
        !r.phone.toLocaleLowerCase('en').includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Pending Returns Section */}
      {pendingReturns.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <History className="w-5 h-5 text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Pending Return Approvals
              <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-bold">
                {pendingReturns.length}
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {pendingReturns.map((rental) => (
              <Card
                key={rental.id}
                className="rounded-xl border-rose-200 bg-rose-50/30 overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-foreground">
                        {rental.fullName || rental.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{rental.phone}</p>
                    </div>
                    <Badge className="bg-rose-500 hover:bg-rose-600 border-none">
                      Pending Review
                    </Badge>
                  </div>

                  <div className="bg-white/60 rounded-xl p-3 border border-rose-100/50">
                    <p className="text-[10px] font-bold uppercase text-rose-600 mb-1">
                      Scooter Submitted On
                    </p>
                    <p className="text-sm font-semibold">
                      {rental.submissionDate
                        ? new Date(rental.submissionDate).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Today'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Camera className="w-3 h-3 text-rose-500" />
                      <p className="text-[10px] text-rose-500 font-bold uppercase">
                        {
                          [
                            rental.photoFront,
                            rental.photoBack,
                            rental.photoLeft,
                            rental.photoRight,
                            rental.photoSpeedometer,
                          ].filter(Boolean).length
                        }{' '}
                        Photos Uploaded
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg"
                      onClick={() => setSelectedReturn(rental)}
                    >
                      Review
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                      disabled={saving}
                      onClick={() => setConfirmApprove(rental)}
                    >
                      {saving && confirmApprove?.id === rental.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : null}
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Rental Plans</h2>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Add Plan
          </Button>
        </div>

        {plans.length > 0 && (
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search plans..."
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <Card className="rounded-xl shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">No rental plans configured</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans
              .filter(
                (p) =>
                  !planSearch ||
                  p.name.toLocaleLowerCase('en').includes(planSearch.toLocaleLowerCase('en'))
              )
              .map((plan) => (
                <Card key={plan.id} className="rounded-xl shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3
                          className={`font-semibold text-foreground ${!plan.isActive ? 'opacity-50' : ''}`}
                        >
                          {plan.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-xs mt-1 ${typeColors[plan.type] || ''}`}
                        >
                          {plan.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                          aria-label="Delete plan"
                          onClick={() => setDeletePlanId(plan.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={plan.isActive}
                          disabled={toggleLoading === plan.id}
                          onCheckedChange={() => togglePlanActive(plan)}
                        />
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <IndianRupee className="w-5 h-5 text-muted-foreground" />
                      <span className="text-3xl font-bold text-foreground">
                        {plan.price.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {plan.durationDays} day{plan.durationDays !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {plan.description && (
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openEdit(plan)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit Plan
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Active Rentals Summary */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Active Rentals
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({activeRentals.length} active
            {rentalSearch || rentalFilter !== 'ALL' ? ` · ${filteredRentals.length} shown` : ''})
          </span>
        </h2>

        {/* Search + Plan Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={rentalSearch}
              onChange={(e) => setRentalSearch(e.target.value)}
              className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
            />
          </div>
          <Select value={rentalFilter} onValueChange={setRentalFilter}>
            <SelectTrigger className="h-9 w-44 rounded-xl border-muted-foreground/20 text-sm">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Plans</SelectItem>
              {plans
                .filter((p) => p.isActive)
                .map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {(rentalSearch || rentalFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setRentalSearch('');
                setRentalFilter('ALL');
              }}
            >
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        <Card className="rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {filteredRentals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarDays className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">
                  {activeRentals.length === 0
                    ? 'No active rentals'
                    : 'No rentals match your filter'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rider</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Current Plan</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRentals.map((rental) => (
                    <TableRow key={rental.id}>
                      <TableCell className="font-medium text-sm">
                        {rental.fullName || rental.name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{rental.phone}</TableCell>
                      <TableCell className="text-sm">{rental.currentPlan || '-'}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {rental.assignedVehicle || rental.vehicleId || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-xs"
                        >
                          ACTIVE
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Plan Dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Add New Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Update rental plan details.' : 'Create a new rental plan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input
                placeholder="e.g. Daily Explorer"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  placeholder="299"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (Days) *</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Brief plan description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePlan}
              disabled={!form.name || !form.price || !form.durationDays || saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Review Dialog */}
      <Dialog open={!!selectedReturn} onOpenChange={() => setSelectedReturn(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Vehicle Return</DialogTitle>
            <DialogDescription>
              Inspection photos submitted by {selectedReturn?.fullName || selectedReturn?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Front', url: selectedReturn.photoFront },
                  { label: 'Back', url: selectedReturn.photoBack },
                  { label: 'Left', url: selectedReturn.photoLeft },
                  { label: 'Right', url: selectedReturn.photoRight },
                  { label: 'Speedometer', url: selectedReturn.photoSpeedometer },
                ].map((photo) => (
                  <div key={photo.label} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                      {photo.label}
                    </p>
                    <div className="aspect-[4/3] rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center relative">
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => window.open(photo.url!, '_blank')}
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground/20" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedReturn(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={saving}
                  onClick={() => setConfirmApprove(selectedReturn)}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Approve Return
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation */}
      <AlertDialog
        open={!!deletePlanId}
        onOpenChange={(o) => {
          if (!o) setDeletePlanId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rental Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this plan? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Return Confirmation */}
      <AlertDialog
        open={!!confirmApprove}
        onOpenChange={(o) => {
          if (!o) setConfirmApprove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Return</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {confirmApprove?.fullName || confirmApprove?.name || 'the rider'}
              &apos;s rental as returned. The rider will no longer have an active rental.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleApproveReturn(confirmApprove!.id)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Approve Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
