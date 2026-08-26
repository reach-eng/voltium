'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, X } from 'lucide-react';

interface OfferFiltersBarProps {
  offerFilter: string;
  setOfferFilter: (val: string) => void;
  onAddOffer: () => void;
}

export function OfferFiltersBar({
  offerFilter,
  setOfferFilter,
  onAddOffer,
}: OfferFiltersBarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Select value={offerFilter} onValueChange={setOfferFilter}>
          <SelectTrigger className="h-11 w-32 rounded-xl border-muted-foreground/20 text-base">
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
            size="default"
            className="h-11 text-sm text-muted-foreground"
            onClick={() => setOfferFilter('ALL')}
          >
            <X className="w-4 h-4 mr-1.5" /> Clear
          </Button>
        )}
      </div>
      <Button onClick={onAddOffer} size="default" className="h-11 px-5 rounded-xl">
        <Plus className="h-5 w-5 mr-1" /> Add Offer
      </Button>
    </div>
  );
}

interface CouponFiltersBarProps {
  couponSearch: string;
  setCouponSearch: (val: string) => void;
  onAddCoupon: () => void;
}

export function CouponFiltersBar({
  couponSearch,
  setCouponSearch,
  onAddCoupon,
}: CouponFiltersBarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by code or description..."
          value={couponSearch}
          onChange={(e) => setCouponSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
        />
      </div>
      <Button onClick={onAddCoupon} size="default" className="h-11 px-5 rounded-xl">
        <Plus className="h-5 w-5 mr-1" /> Add Coupon
      </Button>
    </div>
  );
}
