'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Plus } from 'lucide-react';
import {
  usePaymentGateways,
  type PaymentGateway,
  type MdrBearer,
} from './payment-gateway/usePaymentGateways';
import { PaymentGatewayCard } from './payment-gateway/PaymentGatewayCard';
import { PaymentGatewayEditDialog } from './payment-gateway/PaymentGatewayEditDialog';
import { PaymentGatewayAddDialog } from './payment-gateway/PaymentGatewayAddDialog';

export default function PaymentGatewayManagement() {
  const {
    gateways,
    loading,
    fetchGateways,
    patchGateway,
    patchGatewayFields,
    createGateway,
  } = usePaymentGateways();

  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);

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
            Configure online payment gateways (Razorpay, PhonePe, Cashfree, Easebuzz), edit credentials, and toggle MDR fee bearers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGateways}
            className="gap-2 h-10 px-4 rounded-xl"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="gap-2 h-10 px-4 rounded-xl font-semibold"
          >
            <Plus className="h-4 w-4" /> Add Payment Gateway
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : gateways.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20 space-y-3">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg">No Payment Gateways Configured</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Click &quot;Add Payment Gateway&quot; to set up Razorpay, PhonePe, Cashfree, Easebuzz, or custom gateways.
          </p>
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2 rounded-xl mt-2">
            <Plus className="h-4 w-4" /> Add Payment Gateway
          </Button>
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

      <PaymentGatewayAddDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={createGateway}
      />
    </div>
  );
}

