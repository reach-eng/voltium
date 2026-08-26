'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { PaymentGateway, MdrBearer, Environment } from './usePaymentGateways';

interface Props {
  gateway: PaymentGateway | null;
  onClose: () => void;
  onSave: (gatewayId: string, fields: Partial<PaymentGateway>) => Promise<boolean>;
  onSaved: () => void;
}

/**
 * R3 split — edit dialog for a single payment gateway. Owns its own
 * form state (initialized from the gateway prop when it opens). Calls
 * the parent's `onSave` to persist, then `onSaved` to trigger a refetch.
 */
export function PaymentGatewayEditDialog({ gateway, onClose, onSave, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formMdrBearer, setFormMdrBearer] = useState<MdrBearer>('RIDER');
  const [formExtraFeePercent, setFormExtraFeePercent] = useState<number>(2.5);
  const [formKeyId, setFormKeyId] = useState('');
  const [formKeySecret, setFormKeySecret] = useState('');
  const [formMerchantId, setFormMerchantId] = useState('');
  const [formWebhookSecret, setFormWebhookSecret] = useState('');
  const [formApiEndpoint, setFormApiEndpoint] = useState('');
  const [formEnvironment, setFormEnvironment] = useState<Environment>('TEST');

  // Reset form when the gateway changes
  useEffect(() => {
    if (!gateway) return;
    setFormName(gateway.name || '');
    setFormMdrBearer(gateway.mdrBearer || 'RIDER');
    setFormExtraFeePercent(gateway.extraFeePercent ?? 2.5);
    setFormKeyId(gateway.keyId || '');
    setFormKeySecret(gateway.keySecret || '');
    setFormMerchantId(gateway.merchantId || '');
    setFormWebhookSecret(gateway.webhookSecret || '');
    setFormApiEndpoint(gateway.apiEndpoint || '');
    setFormEnvironment(gateway.environment || 'TEST');
  }, [gateway]);

  const handleSave = async () => {
    if (!gateway) return;
    setSaving(true);
    const ok = await onSave(gateway.id, {
      name: formName,
      mdrBearer: formMdrBearer,
      extraFeePercent: Number(formExtraFeePercent),
      keyId: formKeyId,
      keySecret: formKeySecret,
      merchantId: formMerchantId,
      webhookSecret: formWebhookSecret,
      apiEndpoint: formApiEndpoint,
      environment: formEnvironment,
    });
    setSaving(false);
    if (ok) {
      toast.success(`${gateway.name} updated successfully`);
      onClose();
      onSaved();
    }
  };

  return (
    <Dialog open={!!gateway} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Gateway - {gateway?.name}</DialogTitle>
          <DialogDescription>
            Update gateway credentials, environment mode, and MDR fee settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-1.5">
            <Label>Gateway Display Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Razorpay Gateway"
            />
          </div>

          <div className="space-y-1.5">
            <Label>MDR Fee Option</Label>
            <RadioGroup
              value={formMdrBearer}
              onValueChange={(val: any) => setFormMdrBearer(val)}
              className="grid grid-cols-2 gap-2 pt-1"
            >
              <div className="flex items-center space-x-2 border p-2.5 rounded-lg cursor-pointer">
                <RadioGroupItem value="RIDER" id="mdr-rider" />
                <Label htmlFor="mdr-rider" className="cursor-pointer text-xs font-semibold">
                  Rider pays MDR
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-2.5 rounded-lg cursor-pointer">
                <RadioGroupItem value="MERCHANT" id="mdr-merchant" />
                <Label htmlFor="mdr-merchant" className="cursor-pointer text-xs font-semibold">
                  I pay MDR
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>Surcharge Fee % (MDR)</Label>
            <Input
              type="number"
              step="0.1"
              value={formExtraFeePercent}
              onChange={(e) => setFormExtraFeePercent(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Key ID / App ID</Label>
            <Input
              value={formKeyId}
              onChange={(e) => setFormKeyId(e.target.value)}
              placeholder="rzp_test_..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Key Secret / Salt</Label>
            <Input
              type="password"
              value={formKeySecret}
              onChange={(e) => setFormKeySecret(e.target.value)}
              placeholder="••••••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Merchant ID</Label>
            <Input
              value={formMerchantId}
              onChange={(e) => setFormMerchantId(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Webhook Secret</Label>
            <Input
              value={formWebhookSecret}
              onChange={(e) => setFormWebhookSecret(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Base Endpoint</Label>
            <Input
              value={formApiEndpoint}
              onChange={(e) => setFormApiEndpoint(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Environment</Label>
            <RadioGroup
              value={formEnvironment}
              onValueChange={(val: any) => setFormEnvironment(val)}
              className="grid grid-cols-2 gap-2 pt-1"
            >
              <div className="flex items-center space-x-2 border p-2.5 rounded-lg cursor-pointer">
                <RadioGroupItem value="TEST" id="env-test" />
                <Label htmlFor="env-test" className="cursor-pointer text-xs">
                  Test / Sandbox
                </Label>
              </div>
              <div className="flex items-center space-x-2 border p-2.5 rounded-lg cursor-pointer">
                <RadioGroupItem value="LIVE" id="env-live" />
                <Label
                  htmlFor="env-live"
                  className="cursor-pointer text-xs font-semibold text-emerald-600"
                >
                  Live Production
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Gateway Details'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
