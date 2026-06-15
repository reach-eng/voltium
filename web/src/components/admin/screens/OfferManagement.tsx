'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Sparkles, Search, X, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface Offer {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isSponsored: boolean;
}

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minAmount: number | null;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export default function OfferManagement() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  // Offer dialog
  const [offerDialog, setOfferDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<Partial<Offer> | null>(null);
  const [offerForm, setOfferForm] = useState({
    title: '',
    description: '',
    validFrom: '',
    validUntil: '',
    isSponsored: false,
  });

  // Coupon dialog
  const [couponDialog, setCouponDialog] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Partial<Coupon> | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
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
        discountType: 'percentage',
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Offers & Coupons</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage promotional offers and discount coupons
        </p>
      </div>

      <Tabs defaultValue="offers">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
            <TabsTrigger value="coupons">Coupons ({coupons.length})</TabsTrigger>
          </TabsList>
          <Button size="sm" className="hidden" id="offer-tab-btn" />
        </div>

        <TabsContent value="offers" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Select value={offerFilter} onValueChange={setOfferFilter}>
                <SelectTrigger className="h-9 w-32 rounded-xl border-muted-foreground/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {offerFilter !== 'ALL' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => setOfferFilter('ALL')}
                >
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            <Button onClick={() => openOfferDialog()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Offer
            </Button>
          </div>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : offers.filter(
              (o) => offerFilter === 'ALL' || (offerFilter === 'ACTIVE' ? o.isActive : !o.isActive)
            ).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {offerFilter !== 'ALL' ? 'No matching offers' : 'No offers yet'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offers
                .filter(
                  (o) =>
                    offerFilter === 'ALL' || (offerFilter === 'ACTIVE' ? o.isActive : !o.isActive)
                )
                .map((o) => (
                  <Card key={o.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className={`text-base ${!o.isActive ? 'opacity-50' : ''}`}>
                          {o.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {o.isSponsored && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400 text-[10px]"
                            >
                              <Sparkles className="h-3 w-3 mr-0.5" /> Sponsored
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
                              o.isActive
                                ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                                : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                            }`}
                          >
                            {o.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{o.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(o.validFrom)} — {formatDate(o.validUntil)}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={o.isActive}
                            onCheckedChange={() => toggleOfferActive(o)}
                          />
                          <span className="text-xs">{o.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit offer"
                            onClick={() => openOfferDialog(o)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            aria-label="Delete offer"
                            onClick={() => deleteOffer(o.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or description..."
                value={couponSearch}
                onChange={(e) => setCouponSearch(e.target.value)}
                className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
              />
            </div>
            <Button onClick={() => openCouponDialog()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Coupon
            </Button>
          </div>
          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Amount</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : coupons.filter(
                    (c) =>
                      !debouncedCouponSearch ||
                      c.code
                        .toLocaleLowerCase('en')
                        .includes(debouncedCouponSearch.toLocaleLowerCase('en')) ||
                      (c.description || '')
                        .toLocaleLowerCase('en')
                        .includes(debouncedCouponSearch.toLocaleLowerCase('en'))
                  ).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {debouncedCouponSearch ? 'No coupons match your search' : 'No coupons yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  coupons
                    .filter(
                      (c) =>
                        !debouncedCouponSearch ||
                        c.code
                          .toLocaleLowerCase('en')
                          .includes(debouncedCouponSearch.toLocaleLowerCase('en')) ||
                        (c.description || '')
                          .toLocaleLowerCase('en')
                          .includes(debouncedCouponSearch.toLocaleLowerCase('en'))
                    )
                    .map((c) => (
                      <TableRow key={c.id}>
                        <TableCell
                          className={`font-mono font-bold ${!c.isActive ? 'opacity-50' : ''}`}
                        >
                          {c.code}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{c.description}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {c.discountType === 'percentage'
                              ? `${c.discountValue}%`
                              : `₹${c.discountValue}`}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.minAmount ? `₹${c.minAmount}` : '—'}</TableCell>
                        <TableCell>
                          {c.currentUses}
                          {c.maxUses ? ` / ${c.maxUses}` : ''}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(c.validFrom)} — {formatDate(c.validUntil)}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.isActive}
                            onCheckedChange={() => toggleCouponActive(c)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Edit coupon"
                              onClick={() => openCouponDialog(c)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              aria-label="Delete coupon"
                              onClick={() => deleteCoupon(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Offer Dialog */}
      <Dialog open={offerDialog} onOpenChange={setOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editOffer ? 'Edit' : 'Add'} Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={offerForm.title}
                onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                placeholder="Offer title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={offerForm.description}
                onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                placeholder="Offer description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={offerForm.validFrom}
                  onChange={(e) => setOfferForm({ ...offerForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={offerForm.validUntil}
                  onChange={(e) => setOfferForm({ ...offerForm, validUntil: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={offerForm.isSponsored}
                onCheckedChange={(v) => setOfferForm({ ...offerForm, isSponsored: v })}
              />
              <Label>Sponsored</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={saveOffer}
              disabled={isSaving || !offerForm.title || !offerForm.description}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCoupon ? 'Edit' : 'Add'} Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={couponForm.code}
                onChange={(e) =>
                  setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g. SAVE20"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={couponForm.description}
                onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={couponForm.discountType}
                  onValueChange={(v) => setCouponForm({ ...couponForm, discountType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={couponForm.discountValue}
                  onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount (₹)</Label>
                <Input
                  type="number"
                  value={couponForm.minAmount}
                  onChange={(e) => setCouponForm({ ...couponForm, minAmount: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  value={couponForm.maxUses}
                  onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={couponForm.validFrom}
                  onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={couponForm.validUntil}
                  onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={saveCoupon}
              disabled={isSaving || !couponForm.code || !couponForm.discountValue}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'offer' ? 'Offer' : 'Coupon'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{' '}
              {deleteTarget?.type === 'offer' ? 'offer' : 'coupon'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
