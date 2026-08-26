'use client';

import dynamic from 'next/dynamic';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '../error-boundary';
import {
  useOffers,
  OfferFiltersBar,
  CouponFiltersBar,
  OfferGrid,
  CouponTable,
} from './offers';

// Dynamic code-splitting for heavy modal dialogs
const OfferDialog = dynamic(
  () => import('./offers/OfferDialogs').then((mod) => mod.OfferDialog),
  { ssr: false }
);
const CouponDialog = dynamic(
  () => import('./offers/OfferDialogs').then((mod) => mod.CouponDialog),
  { ssr: false }
);
const DeleteConfirmDialog = dynamic(
  () => import('./offers/OfferDialogs').then((mod) => mod.DeleteConfirmDialog),
  { ssr: false }
);

/**
 * OfferManagement — Main coordinator screen shell.
 * Delegates state management to useOffers() and layout rendering
 * to modular components under ./offers/
 */
export default function OfferManagement() {
  const offerState = useOffers();

  return (
    <AdminErrorBoundary>
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
              <TabsTrigger value="offers">Offers ({offerState.offers.length})</TabsTrigger>
              <TabsTrigger value="coupons">Coupons ({offerState.coupons.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="offers" className="mt-4">
            <OfferFiltersBar
              offerFilter={offerState.offerFilter}
              setOfferFilter={offerState.setOfferFilter}
              onAddOffer={() => offerState.openOfferDialog()}
            />
            <OfferGrid
              loading={offerState.loading}
              offers={offerState.offers}
              offerFilter={offerState.offerFilter}
              onEdit={offerState.openOfferDialog}
              onDelete={offerState.deleteOffer}
              onToggleActive={offerState.toggleOfferActive}
            />
          </TabsContent>

          <TabsContent value="coupons" className="mt-4">
            <CouponFiltersBar
              couponSearch={offerState.couponSearch}
              setCouponSearch={offerState.setCouponSearch}
              onAddCoupon={() => offerState.openCouponDialog()}
            />
            <CouponTable
              loading={offerState.loading}
              coupons={offerState.coupons}
              debouncedCouponSearch={offerState.debouncedCouponSearch}
              onEdit={offerState.openCouponDialog}
              onDelete={offerState.deleteCoupon}
              onToggleActive={offerState.toggleCouponActive}
            />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <OfferDialog
          open={offerState.offerDialog}
          onOpenChange={offerState.setOfferDialog}
          editOffer={offerState.editOffer}
          offerForm={offerState.offerForm}
          setOfferForm={offerState.setOfferForm}
          isSaving={offerState.isSaving}
          onSave={offerState.saveOffer}
        />

        <CouponDialog
          open={offerState.couponDialog}
          onOpenChange={offerState.setCouponDialog}
          editCoupon={offerState.editCoupon}
          couponForm={offerState.couponForm}
          setCouponForm={offerState.setCouponForm}
          isSaving={offerState.isSaving}
          onSave={offerState.saveCoupon}
        />

        <DeleteConfirmDialog
          deleteTarget={offerState.deleteTarget}
          onClose={() => offerState.setDeleteTarget(null)}
          isDeleting={offerState.isDeleting}
          onConfirm={offerState.confirmDelete}
        />
      </div>
    </AdminErrorBoundary>
  );
}
