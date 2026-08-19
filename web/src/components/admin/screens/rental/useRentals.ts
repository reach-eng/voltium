'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_PLAN_FORM,
  PLAN_TYPE_DURATIONS,
  riderDisplayName,
  type ActiveRental,
  type PlanFormState,
  type PlanType,
  type RentalPlan,
} from './types';

/**
 * R3.7y split — Rental Management data hook.
 *
 * Owns: plans list, active rentals (derived from /api/admin/riders),
 * pending returns, plan form, dialogs, and the mutation handlers
 * (save / delete / toggle-active / approve-return).
 */
export function useRentals() {
  const [plans, setPlans] = useState<RentalPlan[]>([]);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  const [pendingReturns, setPendingReturns] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RentalPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>({ ...EMPTY_PLAN_FORM });
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [rentalSearch, setRentalSearch] = useState('');
  const [rentalFilter, setRentalFilter] = useState('ALL');
  const [planSearch, setPlanSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ActiveRental | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<ActiveRental | null>(null);

  const fetchAll = useCallback(async () => {
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
        const allRiders: ActiveRental[] = rentalsJson.data?.riders || [];
        setActiveRentals(
          allRiders.filter((r) => r.lifecycleStatus === 'ACTIVE' && !r.returnPending)
        );
        setPendingReturns(allRiders.filter((r) => r.returnPending === true));
      }
    } catch (err) {
      logger.error('Failed to fetch rental data', { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredPlans = useMemo(() => {
    if (!planSearch) return plans;
    const q = planSearch.toLowerCase();
    return plans.filter((p) => p.name.toLowerCase().includes(q));
  }, [plans, planSearch]);

  const filteredRentals = useMemo(() => {
    return activeRentals.filter((r) => {
      if (rentalFilter !== 'ALL' && r.currentPlan !== rentalFilter) return false;
      if (rentalSearch) {
        const q = rentalSearch.toLowerCase();
        if (
          !riderDisplayName(r).toLowerCase().includes(q) &&
          !r.phone.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [activeRentals, rentalFilter, rentalSearch]);

  const openCreate = useCallback(() => {
    setEditingPlan(null);
    setForm({ ...EMPTY_PLAN_FORM });
    setPlanDialogOpen(true);
  }, []);

  const openEdit = useCallback((plan: RentalPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      type: plan.type as PlanType,
      price: String(plan.price),
      securityDeposit: String(plan.securityDeposit || 0),
      isSecurityRefundable: plan.isSecurityRefundable ?? true,
      refundableAfterDays: plan.refundableAfterDays
        ? String(plan.refundableAfterDays)
        : '',
      description: plan.description || '',
      additionalInfo: plan.additionalInfo || '',
      isActive: plan.isActive,
    });
    setPlanDialogOpen(true);
  }, []);

  const closePlanDialog = useCallback(() => {
    setPlanDialogOpen(false);
    setEditingPlan(null);
  }, []);

  const handleSavePlan = useCallback(async () => {
    if (!form.name || !form.price || Number(form.price) <= 0) {
      toast.error('Plan name and a positive price (₹) are required');
      return;
    }
    if (Number(form.securityDeposit) < 0) {
      toast.error('Security deposit cannot be negative');
      return;
    }
    setSaving(true);
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const baseBody = {
        ...form,
        price: Number(form.price),
        securityDeposit: Number(form.securityDeposit),
        refundableAfterDays: form.refundableAfterDays
          ? Number(form.refundableAfterDays)
          : null,
        durationDays: PLAN_TYPE_DURATIONS[form.type],
      };

      const body = editingPlan
        ? { id: editingPlan.id, ...baseBody }
        : baseBody;

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
      closePlanDialog();
      fetchAll();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [editingPlan, form, fetchAll, closePlanDialog]);

  const togglePlanActive = useCallback(
    async (plan: RentalPlan) => {
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
        fetchAll();
      } catch {
        toast.error('Network error. Please try again.');
      } finally {
        setToggleLoading(null);
      }
    },
    [fetchAll]
  );

  const handleDeletePlan = useCallback(async () => {
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
      fetchAll();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [deletePlanId, fetchAll]);

  const handleApproveReturn = useCallback(
    async (riderId: string) => {
      setSaving(true);
      try {
        const res = await fetch('/api/admin/rentals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaseId: riderId,
            action: 'APPROVE_RETURN',
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(json?.error?.message || 'Failed to approve return');
          return;
        }
        toast.success('Return approved successfully');
        setConfirmApprove(null);
        setSelectedReturn(null);
        fetchAll();
      } catch {
        toast.error('Network error. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [fetchAll]
  );

  return {
    // data
    plans,
    activeRentals,
    pendingReturns,
    loading,
    // filters
    rentalSearch,
    setRentalSearch,
    rentalFilter,
    setRentalFilter,
    planSearch,
    setPlanSearch,
    // derived
    filteredPlans,
    filteredRentals,
    // plan form
    planDialogOpen,
    closePlanDialog,
    editingPlan,
    form,
    setForm,
    openCreate,
    openEdit,
    handleSavePlan,
    togglePlanActive,
    toggleLoading,
    deletePlanId,
    setDeletePlanId,
    handleDeletePlan,
    // returns
    selectedReturn,
    setSelectedReturn,
    confirmApprove,
    setConfirmApprove,
    handleApproveReturn,
    // status
    saving,
    // revalidation
    fetchAll,
  };
}

export type RentalsHook = ReturnType<typeof useRentals>;
