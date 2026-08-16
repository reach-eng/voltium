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

/** Mutable form state of the edit dialog. */
export interface GatewayFormState {
  name: string;
  mdrBearer: MdrBearer;
  extraFeePercent: number;
  keyId: string;
  keySecret: string;
  merchantId: string;
  webhookSecret: string;
  apiEndpoint: string;
  environment: Environment;
}

/**
 * PR-VER-2026-08-07 (PAYMENT_GATEWAY P0-4): change-only credential semantics.
 * The API returns stored credentials decrypted, so the form must NEVER
 * pre-populate them — echoing them back into the inputs re-exposes the
 * plaintext secret. Both secret fields start blank and are only included in
 * the update payload when the admin types a new value (an empty string would
 * silently wipe the stored secret). Extracted as pure functions so the
 * invariant is unit-testable without a DOM.
 */
export function gatewayFormDefaults(gateway: PaymentGateway): GatewayFormState {
  return {
    name: gateway.name || '',
    mdrBearer: gateway.mdrBearer || 'RIDER',
    extraFeePercent: gateway.extraFeePercent ?? 2.5,
    keyId: gateway.keyId || '',
    keySecret: '', // never pre-populated
    merchantId: gateway.merchantId || '',
    webhookSecret: '', // never pre-populated
    apiEndpoint: gateway.apiEndpoint || '',
    environment: gateway.environment || 'TEST',
  };
}

export function buildGatewayUpdateFields(
  form: GatewayFormState
): Partial<PaymentGateway> {
  const fields: Partial<PaymentGateway> = {
    name: form.name,
    mdrBearer: form.mdrBearer,
    extraFeePercent: Number(form.extraFeePercent),
    keyId: form.keyId,
    merchantId: form.merchantId,
    apiEndpoint: form.apiEndpoint,
    environment: form.environment,
  };
  // Change-only credentials: sending an empty string would silently wipe
  // the stored secret, so only include a field when the admin typed one.
  if (form.keySecret.trim().length > 0) fields.keySecret = form.keySecret;
  if (form.webhookSecret.trim().length > 0) {
    fields.webhookSecret = form.webhookSecret;
  }
  return fields;
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
    const defaults = gatewayFormDefaults(gateway);
    setFormName(defaults.name);
    setFormMdrBearer(defaults.mdrBearer);
    setFormExtraFeePercent(defaults.extraFeePercent);
    setFormKeyId(defaults.keyId);
    // PR-VER-2026-08-07 (PAYMENT_GATEWAY P0-4): never pre-populate the
    // credential fields — the API returns them decrypted, so echoing them
    // back into the form re-exposes the plaintext secret. Change-only
    // semantics: the fields start blank and are only sent when typed.
    setFormKeySecret(defaults.keySecret);
    setFormMerchantId(defaults.merchantId);
    setFormWebhookSecret(defaults.webhookSecret);
    setFormApiEndpoint(defaults.apiEndpoint);
    setFormEnvironment(defaults.environment);
  }, [gateway]);

  const handleSave = async () => {
    if (!gateway) return;
    setSaving(true);
    const fields = buildGatewayUpdateFields({
      name: formName,
      mdrBearer: formMdrBearer,
      extraFeePercent: formExtraFeePercent,
      keyId: formKeyId,
      keySecret: formKeySecret,
      merchantId: formMerchantId,
      webhookSecret: formWebhookSecret,
      apiEndpoint: formApiEndpoint,
      environment: formEnvironment,
    });
    const ok = await onSave(gateway.id, fields);
    setSaving(false);
    if (ok) {
      toast.success(`${gateway.name} updated successfully`);
      onClose();
      onSaved();
    }
  };

  return (
    <Dialog
      open={!!gateway}
      onOpenChange={(open) => {
        if (!open) {
          // Clear credential state on close so the next open never shows
          // (or re-sends) the previous gateway's secret.
          setFormKeySecret('');
          setFormWebhookSecret('');
          onClose();
        }
      }}
    >
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
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the existing secret unchanged.
            </p>
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
              type="password"
              value={formWebhookSecret}
              onChange={(e) => setFormWebhookSecret(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the existing secret unchanged.
            </p>
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
                  className="cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400"
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
