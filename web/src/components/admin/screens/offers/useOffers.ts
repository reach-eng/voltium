import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Offer, Coupon, OfferForm, CouponForm } from './types';

export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Offer dialog state
  const [offerDialog, setOfferDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<Partial<Offer> | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>({
    title: '',
    description: '',
    validFrom: '',
    validUntil: '',
    isSponsored: false,
  });

  // Coupon dialog state
  const [couponDialog, setCouponDialog] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Partial<Coupon> | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minAmount: '',
    maxUses: '',
    validFrom: '',
    validUntil: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [offerFilter, setOfferFilter] = useState('ALL');
  const [couponSearch, setCouponSearch] = useState('');
  const [debouncedCouponSearch, setDebouncedCouponSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce coupon search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCouponSearch(couponSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [couponSearch]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [oRes, cRes] = await Promise.all([
        fetch('/api/admin/offers'),
        fetch('/api/admin/coupons'),
      ]);
      if (oRes.status === 403 || cRes.status === 403) {
        return;
      }
      if (!oRes.ok) {
        logger.error('Failed to fetch offers', { status: oRes.status });
        return;
      }
      if (!cRes.ok) {
        logger.error('Failed to fetch coupons', { status: cRes.status });
        return;
      }
      const oJson = await oRes.json();
      const cJson = await cRes.json();
      if (oJson.success) setOffers(oJson.data || []);
      if (cJson.success) setCoupons(cJson.data || []);
    } catch (err) {
      logger.error('Error fetching offers data', { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Offer CRUD
  const openOfferDialog = (offer?: Offer) => {
    if (offer) {
      setEditOffer(offer);
      setOfferForm({
        title: offer.title,
        description: offer.description,
        validFrom: offer.validFrom.slice(0, 10),
        validUntil: offer.validUntil.slice(0, 10),
        isSponsored: offer.isSponsored,
      });
    } else {
      setEditOffer(null);
      setOfferForm({
        title: '',
        description: '',
        validFrom: '',
        validUntil: '',
        isSponsored: false,
      });
    }
    setOfferDialog(true);
  };

  const saveOffer = async () => {
    try {
      setIsSaving(true);
      const payload = { ...offerForm };
      const res = await fetch('/api/admin/offers', {
        method: editOffer?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editOffer?.id ? { id: editOffer.id, ...payload } : payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to save offer');
        return;
      }

      toast.success(editOffer?.id ? 'Offer updated' : 'Offer created');
      setOfferDialog(false);
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOffer = (id: string) => {
    setDeleteTarget({ type: 'offer', id });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const endpoint = deleteTarget.type === 'offer' ? 'offers' : 'coupons';
      const res = await fetch(`/api/admin/${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || `Failed to delete ${deleteTarget.type}`);
        return;
      }

      toast.success(`${deleteTarget.type === 'offer' ? 'Offer' : 'Coupon'} deleted`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleOfferActive = async (offer: Offer) => {
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: offer.id, isActive: !offer.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to toggle offer');
        return;
      }
      toast.success(offer.isActive ? 'Offer deactivated' : 'Offer activated');
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  // Coupon CRUD
  const openCouponDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditCoupon(coupon);
      setCouponForm({
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: String(coupon.discountValue),
        minAmount: coupon.minAmount ? String(coupon.minAmount) : '',
        maxUses: coupon.maxUses ? String(coupon.maxUses) : '',
        validFrom: coupon.validFrom.slice(0, 10),
        validUntil: coupon.validUntil.slice(0, 10),
      });
    } else {
      setEditCoupon(null);
      setCouponForm({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        minAmount: '',
        maxUses: '',
        validFrom: '',
        validUntil: '',
      });
    }
    setCouponDialog(true);
  };

  const saveCoupon = async () => {
    try {
      setIsSaving(true);
      const payload = {
        ...couponForm,
        discountValue: Number(couponForm.discountValue),
        minAmount: couponForm.minAmount ? Number(couponForm.minAmount) : null,
        maxUses: couponForm.maxUses ? Number(couponForm.maxUses) : null,
      };

      const res = await fetch('/api/admin/coupons', {
        method: editCoupon?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCoupon?.id ? { id: editCoupon.id, ...payload } : payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to save coupon');
        return;
      }

      toast.success(editCoupon?.id ? 'Coupon updated' : 'Coupon created');
      setCouponDialog(false);
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoupon = (id: string) => {
    setDeleteTarget({ type: 'coupon', id });
  };

  const toggleCouponActive = async (coupon: Coupon) => {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to toggle coupon');
        return;
      }
      toast.success(coupon.isActive ? 'Coupon deactivated' : 'Coupon activated');
      fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  return {
    offers,
    coupons,
    loading,
    offerDialog,
    setOfferDialog,
    editOffer,
    offerForm,
    setOfferForm,
    couponDialog,
    setCouponDialog,
    editCoupon,
    couponForm,
    setCouponForm,
    deleteTarget,
    setDeleteTarget,
    offerFilter,
    setOfferFilter,
    couponSearch,
    setCouponSearch,
    debouncedCouponSearch,
    isSaving,
    isDeleting,
    fetchData,
    openOfferDialog,
    saveOffer,
    deleteOffer,
    confirmDelete,
    toggleOfferActive,
    openCouponDialog,
    saveCoupon,
    deleteCoupon,
    toggleCouponActive,
  };
}
