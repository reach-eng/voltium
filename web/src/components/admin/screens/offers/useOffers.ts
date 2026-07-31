'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_COUPON_FORM,
  EMPTY_OFFER_FORM,
  type Coupon,
  type CouponForm,
  type DeleteTarget,
  type Offer,
  type OfferForm,
  type OfferStatusFilter,
} from './types';

/**
 * R3 split (OfferManagement) — data hook.
 *
 * Owns the offers + coupons lists, the offer form + coupon
 * form state, the dialog visibility, the search/filter state,
 * and the network handlers (fetch, save offer, save coupon,
 * delete, toggle active). The local `filteredCoupons` array
 * applies the debounced search on the client.
 */
export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Offer dialog
  const [offerDialog, setOfferDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [offerForm, setOfferForm] = useState<OfferForm>({ ...EMPTY_OFFER_FORM });

  // Coupon dialog
  const [couponDialog, setCouponDialog] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>({ ...EMPTY_COUPON_FORM });

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [offerFilter, setOfferFilter] = useState<OfferStatusFilter>('ALL');
  const [couponSearch, setCouponSearch] = useState('');
  const [debouncedCouponSearch, setDebouncedCouponSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce coupon search → 500ms before filtering
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
        // Silently handle — admin lacks offers_manage permission
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
      if (oJson.success) setOffers(oJson.data);
      if (cJson.success) setCoupons(cJson.data);
    } catch {
      /* empty */
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
      setOfferForm({ ...EMPTY_OFFER_FORM });
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
      setCouponForm({ ...EMPTY_COUPON_FORM });
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

  // Derived: filtered coupons (client-side)
  const filteredCoupons = coupons.filter(
    (c) =>
      !debouncedCouponSearch ||
      c.code.toLocaleLowerCase('en').includes(debouncedCouponSearch.toLocaleLowerCase('en')) ||
      (c.description || '')
        .toLocaleLowerCase('en')
        .includes(debouncedCouponSearch.toLocaleLowerCase('en'))
  );

  // Derived: filtered offers (client-side)
  const filteredOffers = offers.filter(
    (o) => offerFilter === 'ALL' || (offerFilter === 'ACTIVE' ? o.isActive : !o.isActive)
  );

  return {
    // data
    offers,
    coupons,
    filteredOffers,
    filteredCoupons,
    loading,
    // offer form
    offerDialog,
    setOfferDialog,
    editOffer,
    offerForm,
    setOfferForm,
    openOfferDialog,
    saveOffer,
    toggleOfferActive,
    // coupon form
    couponDialog,
    setCouponDialog,
    editCoupon,
    couponForm,
    setCouponForm,
    openCouponDialog,
    saveCoupon,
    toggleCouponActive,
    // delete
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    // filters
    offerFilter,
    setOfferFilter,
    couponSearch,
    setCouponSearch,
    debouncedCouponSearch,
    // saving state
    isSaving,
    isDeleting,
    // revalidation
    fetchData,
  };
}

export type OffersHook = ReturnType<typeof useOffers>;
