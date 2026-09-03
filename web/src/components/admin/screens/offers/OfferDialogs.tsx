'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { Offer, Coupon, OfferForm, CouponForm } from './types';

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editOffer: Partial<Offer> | null;
  offerForm: OfferForm;
  setOfferForm: (form: OfferForm) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function OfferDialog({
  open,
  onOpenChange,
  editOffer,
  offerForm,
  setOfferForm,
  isSaving,
  onSave,
}: OfferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || !offerForm.title || !offerForm.description}
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editOffer ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCoupon: Partial<Coupon> | null;
  couponForm: CouponForm;
  setCouponForm: (form: CouponForm) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function CouponDialog({
  open,
  onOpenChange,
  editCoupon,
  couponForm,
  setCouponForm,
  isSaving,
  onSave,
}: CouponDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              placeholder="Coupon description"
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
                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  <SelectItem value="FIXED">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input
                type="number"
                min="1"
                max={couponForm.discountType === 'PERCENTAGE' ? 100 : undefined}
                value={couponForm.discountValue}
                onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                placeholder={couponForm.discountType === 'PERCENTAGE' ? '20' : '100'}
              />
              {couponForm.discountType === 'PERCENTAGE' && Number(couponForm.discountValue) > 100 && (
                <p className="text-xs text-destructive font-medium">
                  Percentage discount cannot exceed 100%
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Order Amount (₹)</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={
              isSaving ||
              !couponForm.code ||
              !couponForm.discountValue ||
              (couponForm.discountType === 'PERCENTAGE' && Number(couponForm.discountValue) > 100)
            }
          >
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {editCoupon ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  deleteTarget: { type: string; id: string } | null;
  onClose: () => void;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  deleteTarget,
  onClose,
  isDeleting,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={!!deleteTarget} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the{' '}
            {deleteTarget?.type === 'offer' ? 'offer' : 'coupon'}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
