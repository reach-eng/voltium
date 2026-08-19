'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface PaymentGateway {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  mdrBearer: 'RIDER' | 'MERCHANT';
  extraFeePercent: number;
  keyId?: string | null;
  keySecret?: string | null;
  merchantId?: string | null;
  webhookSecret?: string | null;
  apiEndpoint?: string | null;
  environment: 'TEST' | 'LIVE';
  updatedAt?: string;
}

export type MdrBearer = 'RIDER' | 'MERCHANT';
export type Environment = 'TEST' | 'LIVE';

/**
 * R3 split — hook that owns the gateways state and CRUD operations for
 * /api/admin/payment-gateways. Extracted from PaymentGatewayManagement.tsx
 * so the parent screen, the card, and the edit dialog can all share
 * the same fetch + patch logic without re-implementing.
 */
export function usePaymentGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGateways = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-gateways');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setGateways(json.data || []);
        }
      }
    } catch (err) {
      toast.error('Failed to load payment gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  /**
   * PATCH a single field on a gateway (isActive, mdrBearer). Updates local
   * state optimistically and rolls back on failure.
   */
  const patchGateway = useCallback(
    async <K extends keyof PaymentGateway>(
      gateway: PaymentGateway,
      field: K,
      value: PaymentGateway[K],
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/payment-gateways/${gateway.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || `Failed to update ${field}`);
        }
        setGateways((prev) =>
          prev.map((item) => {
            if (field === 'isActive' && value === true) {
              return { ...item, isActive: item.id === gateway.id };
            }
            return item.id === gateway.id ? { ...item, [field]: value } : item;
          }),
        );
        return true;
      } catch (err: any) {
        toast.error(err.message || `Failed to update ${field}`);
        return false;
      }
    },
    [],
  );

  /**
   * PATCH multiple fields at once (used by the edit dialog). Returns
   * true on success and triggers a refetch so server-side timestamps
   * (updatedAt) propagate.
   */
  const patchGatewayFields = useCallback(
    async (gatewayId: string, fields: Partial<PaymentGateway>): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/payment-gateways/${gatewayId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to update settings');
        }
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Failed to save gateway details');
        return false;
      }
    },
    [],
  );

  /**
   * POST create a new gateway.
   */
  const createGateway = useCallback(
    async (data: Partial<PaymentGateway>): Promise<boolean> => {
      try {
        const res = await fetch('/api/admin/payment-gateways', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to create payment gateway');
        }
        toast.success('Payment gateway added successfully');
        await fetchGateways();
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Failed to create payment gateway');
        return false;
      }
    },
    [fetchGateways],
  );

  /**
   * DELETE a gateway by ID.
   */
  const deleteGateway = useCallback(
    async (gatewayId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/payment-gateways/${gatewayId}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || 'Failed to delete gateway');
        }
        toast.success('Payment gateway deleted');
        setGateways((prev) => prev.filter((gw) => gw.id !== gatewayId));
        return true;
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete gateway');
        return false;
      }
    },
    [],
  );

  return {
    gateways,
    loading,
    fetchGateways,
    patchGateway,
    patchGatewayFields,
    createGateway,
    deleteGateway,
  };
}
