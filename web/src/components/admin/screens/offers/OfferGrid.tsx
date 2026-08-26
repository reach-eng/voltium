'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Sparkles } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Offer, Coupon } from './types';

interface OfferGridProps {
  loading: boolean;
  offers: Offer[];
  offerFilter: string;
  onEdit: (offer: Offer) => void;
  onDelete: (id: string) => void;
  onToggleActive: (offer: Offer) => void;
}

export function OfferGrid({
  loading,
  offers,
  offerFilter,
  onEdit,
  onDelete,
  onToggleActive,
}: OfferGridProps) {
  const filteredOffers = offers.filter(
    (o) => offerFilter === 'ALL' || (offerFilter === 'ACTIVE' ? o.isActive : !o.isActive)
  );

  if (loading) {
    return (
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
    );
  }

  if (filteredOffers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {offerFilter !== 'ALL' ? 'No matching offers' : 'No offers yet'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredOffers.map((o) => (
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
              {formatDateDDMMYYYY(o.validFrom)} — {formatDateDDMMYYYY(o.validUntil)}
            </p>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={o.isActive}
                  onCheckedChange={() => onToggleActive(o)}
                />
                <span className="text-xs">{o.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  aria-label="Edit offer"
                  onClick={() => onEdit(o)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
                  aria-label="Delete offer"
                  onClick={() => onDelete(o.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface CouponTableProps {
  loading: boolean;
  coupons: Coupon[];
  debouncedCouponSearch: string;
  onEdit: (coupon: Coupon) => void;
  onDelete: (id: string) => void;
  onToggleActive: (coupon: Coupon) => void;
}

export function CouponTable({
  loading,
  coupons,
  debouncedCouponSearch,
  onEdit,
  onDelete,
  onToggleActive,
}: CouponTableProps) {
  const filteredCoupons = coupons.filter(
    (c) =>
      !debouncedCouponSearch ||
      c.code
        .toLocaleLowerCase('en')
        .includes(debouncedCouponSearch.toLocaleLowerCase('en')) ||
      (c.description || '')
        .toLocaleLowerCase('en')
        .includes(debouncedCouponSearch.toLocaleLowerCase('en'))
  );

  return (
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
          ) : filteredCoupons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {debouncedCouponSearch ? 'No coupons match your search' : 'No coupons yet'}
              </TableCell>
            </TableRow>
          ) : (
            filteredCoupons.map((c) => (
              <TableRow key={c.id}>
                <TableCell
                  className={`font-mono font-bold ${!c.isActive ? 'opacity-50' : ''}`}
                >
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
                    onCheckedChange={() => onToggleActive(c)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      aria-label="Edit coupon"
                      onClick={() => onEdit(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-red-500 hover:text-red-700 hover:bg-red-50"
                      aria-label="Delete coupon"
                      onClick={() => onDelete(c.id)}
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
  );
}
