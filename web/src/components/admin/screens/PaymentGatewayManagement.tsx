'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import {
  usePaymentGateways,
  type PaymentGateway,
  type MdrBearer,
} from './payment-gateway/usePaymentGateways';
import { PaymentGatewayCard } from './payment-gateway/PaymentGatewayCard';
import { PaymentGatewayEditDialog } from './payment-gateway/PaymentGatewayEditDialog';

/**
 * R3 split — payment-gateway management screen. R3.7a (smallest of the
 * 15 admin screens >15KB at 15.8 KB pre-split). After the split this
 * file is now a thin shell that:
 *   1. Owns the data via `usePaymentGateways` (fetch + patch)
 *   2. Renders a grid of `PaymentGatewayCard`s
 *   3. Hosts the `PaymentGatewayEditDialog` modal
 *
 * Net result: this file is ~75 lines (was 396); the card and dialog
 * live in their own files and are independently testable.
 */
export default function PaymentGatewayManagement() {
  const { gateways, loading, fetchGateways, patchGateway, patchGatewayFields } =
    usePaymentGateways();
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);

  const handleToggleActive = (gw: PaymentGateway, newStatus: boolean) => {
    patchGateway(gw, 'isActive', newStatus);
  };

  const handleToggleMdrBearer = (gw: PaymentGateway, bearer: MdrBearer) => {
    patchGateway(gw, 'mdrBearer', bearer);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Payment Gateways</h2>
          <p className="text-muted-foreground text-sm">
            Configure instant online top-up gateways, edit credentials, and toggle MDR fee bearers.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchGateways}
          className="gap-2 h-10 px-4 rounded-xl"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gateways.map((gw) => (
            <PaymentGatewayCard
              key={gw.id}
              gateway={gw}
              onToggleActive={handleToggleActive}
              onToggleMdrBearer={handleToggleMdrBearer}
              onEdit={setEditingGateway}
            />
          ))}
        </div>
      )}

      <PaymentGatewayEditDialog
        gateway={editingGateway}
        onClose={() => setEditingGateway(null)}
        onSave={patchGatewayFields}
        onSaved={fetchGateways}
      />
    </div>
  );
}
