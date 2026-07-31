'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { useOffers } from './offers/useOffers';

/**
 * R3 split (OfferManagement) — shell.
 *
 * Pre-split: 30.9 KB / 845 lines with 13 useState + 5 fetch handlers
 * + 2 forms + 2 tables + 3 dialogs inline. Post-split: thin
 * orchestrator that wires the data hook. The state machine +
 * network logic lives in `useOffers` (9.2 KB). The shell keeps
 * the 2 forms + 2 tables + 3 dialogs inline because the screen
 * is structurally a single Tabs view that interleaves Offers and
 * Coupons; further splitting would just add imports without a
 * real readability win.
 */
export default function OfferManagement() {
  const o = useOffers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Offers &amp; Coupons</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage promotional offers and discount coupons
        </p>
      </div>

      <Tabs defaultValue="offers">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="offers">Offers ({o.offers.length})</TabsTrigger>
            <TabsTrigger value="coupons">Coupons ({o.coupons.length})</TabsTrigger>
          </TabsList>
          <Button size="sm" className="hidden" id="offer-tab-btn" />
        </div>

        <TabsContent value="offers" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Select
                value={o.offerFilter}
                onValueChange={(v) => o.setOfferFilter(v as typeof o.offerFilter)}
              >
                <SelectTrigger className="h-11 w-32 rounded-xl border-muted-foreground/20 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {o.offerFilter !== 'ALL' && (
                <Button
                  variant="ghost"
                  size="default"
                  className="h-11 text-sm text-muted-foreground"
                  onClick={() => o.setOfferFilter('ALL')}
                >
                  <X className="w-4 h-4 mr-1.5" /> Clear
                </Button>
              )}
            </div>
            <Button onClick={() => o.openOfferDialog()} size="default" className="h-11 px-5 rounded-xl">
              <Plus className="h-5 w-5 mr-1" /> Add Offer
            </Button>
          </div>
          {o.loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-4 w-44" />
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <div className="flex gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : o.filteredOffers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {o.offerFilter !== 'ALL' ? 'No matching offers' : 'No offers yet'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {o.filteredOffers.map((offer) => (
                <Card key={offer.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle
                        className={`text-base ${!offer.isActive ? 'opacity-50' : ''}`}
                      >
                        {offer.title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {offer.isSponsored && (
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
                            offer.isActive
                              ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                              : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                          }`}
                        >
                          {offer.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {offer.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateDDMMYYYY(offer.validFrom)} — {formatDateDDMMYYYY(offer.validUntil)}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={offer.isActive}
                          onCheckedChange={() => o.toggleOfferActive(offer)}
                        />
                        <span className="text-xs">{offer.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          aria-label="Edit offer"
                          onClick={() => o.openOfferDialog(offer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
                          aria-label="Delete offer"
                          onClick={() => o.setDeleteTarget({ type: 'offer', id: offer.id })}
                        >
                          <Trash2 className="h-4 w-4" />
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
                value={o.couponSearch}
                onChange={(e) => o.setCouponSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
              />
            </div>
            <Button
              onClick={() => o.openCouponDialog()}
              size="default"
              className="h-11 px-5 rounded-xl"
            >
              <Plus className="h-5 w-5 mr-1" /> Add Coupon
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
                {o.loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-in fade-in duration-500">
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-10 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : o.filteredCoupons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {o.debouncedCouponSearch ? 'No coupons match your search' : 'No coupons yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  o.filteredCoupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className={`font-mono font-bold ${!c.isActive ? 'opacity-50' : ''}`}>
                        {c.code}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {c.discountType === 'PERCENTAGE'
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
                        {formatDateDDMMYYYY(c.validFrom)} — {formatDateDDMMYYYY(c.validUntil)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.isActive}
                          onCheckedChange={() => o.toggleCouponActive(c)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            aria-label="Edit coupon"
                            onClick={() => o.openCouponDialog(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
                            aria-label="Delete coupon"
                            onClick={() => o.setDeleteTarget({ type: 'coupon', id: c.id })}
                          >
                            <Trash2 className="h-4 w-4" />
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
      <Dialog open={o.offerDialog} onOpenChange={o.setOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{o.editOffer ? 'Edit' : 'Add'} Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={o.offerForm.title}
                onChange={(e) => o.setOfferForm({ ...o.offerForm, title: e.target.value })}
                placeholder="Offer title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={o.offerForm.description}
                onChange={(e) => o.setOfferForm({ ...o.offerForm, description: e.target.value })}
                placeholder="Offer description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={o.offerForm.validFrom}
                  onChange={(e) => o.setOfferForm({ ...o.offerForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={o.offerForm.validUntil}
                  onChange={(e) => o.setOfferForm({ ...o.offerForm, validUntil: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={o.offerForm.isSponsored}
                onCheckedChange={(v) => o.setOfferForm({ ...o.offerForm, isSponsored: v })}
              />
              <Label>Sponsored</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => o.setOfferDialog(false)}
              disabled={o.isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={o.saveOffer}
              disabled={o.isSaving || !o.offerForm.title || !o.offerForm.description}
            >
              {o.isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {o.isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={o.couponDialog} onOpenChange={o.setCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{o.editCoupon ? 'Edit' : 'Add'} Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={o.couponForm.code}
                onChange={(e) =>
                  o.setCouponForm({ ...o.couponForm, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g. SAVE20"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={o.couponForm.description}
                onChange={(e) => o.setCouponForm({ ...o.couponForm, description: e.target.value })}
                placeholder="Brief description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select
                  value={o.couponForm.discountType}
                  onValueChange={(v) => o.setCouponForm({ ...o.couponForm, discountType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input
                  type="number"
                  value={o.couponForm.discountValue}
                  onChange={(e) => o.setCouponForm({ ...o.couponForm, discountValue: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount (₹)</Label>
                <Input
                  type="number"
                  value={o.couponForm.minAmount}
                  onChange={(e) => o.setCouponForm({ ...o.couponForm, minAmount: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  value={o.couponForm.maxUses}
                  onChange={(e) => o.setCouponForm({ ...o.couponForm, maxUses: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input
                  type="date"
                  value={o.couponForm.validFrom}
                  onChange={(e) => o.setCouponForm({ ...o.couponForm, validFrom: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={o.couponForm.validUntil}
                  onChange={(e) => o.setCouponForm({ ...o.couponForm, validUntil: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => o.setCouponDialog(false)}
              disabled={o.isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={o.saveCoupon}
              disabled={o.isSaving || !o.couponForm.code || !o.couponForm.discountValue}
            >
              {o.isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {o.isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!o.deleteTarget}
        onOpenChange={(open) => {
          if (!open) o.setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {o.deleteTarget?.type === 'offer' ? 'Offer' : 'Coupon'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this{' '}
              {o.deleteTarget?.type === 'offer' ? 'offer' : 'coupon'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={o.isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={o.confirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={o.isDeleting}
            >
              {o.isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {o.isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
