'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { PaymentGateway, MdrBearer, Environment } from './usePaymentGateways';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<PaymentGateway>) => Promise<boolean>;
}

const PROVIDER_PRESETS: Record<string, { name: string; extraFee: number; bearer: MdrBearer }> = {
  RAZORPAY: { name: 'Razorpay', extraFee: 2.0, bearer: 'RIDER' },
  PHONEPE: { name: 'PhonePe Business', extraFee: 1.8, bearer: 'MERCHANT' },
  CASHFREE: { name: 'Cashfree Payments', extraFee: 1.9, bearer: 'RIDER' },
  EASEBUZZ: { name: 'Easebuzz', extraFee: 1.5, bearer: 'MERCHANT' },
  PAYU: { name: 'PayU', extraFee: 2.0, bearer: 'RIDER' },
  PAYTM: { name: 'Paytm Business', extraFee: 1.9, bearer: 'MERCHANT' },
  CUSTOM: { name: 'Custom Gateway', extraFee: 2.0, bearer: 'RIDER' },
};

export function PaymentGatewayAddDialog({ open, onClose, onSave }: Props) {
  const [provider, setProvider] = useState<string>('RAZORPAY');
  const [name, setName] = useState<string>('Razorpay');
  const [environment, setEnvironment] = useState<Environment>('LIVE');
  const [mdrBearer, setMdrBearer] = useState<MdrBearer>('RIDER');
  const [extraFeePercent, setExtraFeePercent] = useState<number>(2.0);
  const [keyId, setKeyId] = useState<string>('');
  const [keySecret, setKeySecret] = useState<string>('');
  const [merchantId, setMerchantId] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [apiEndpoint, setApiEndpoint] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const handleProviderChange = (val: string) => {
    setProvider(val);
    const preset = PROVIDER_PRESETS[val];
    if (preset) {
      setName(preset.name);
      setExtraFeePercent(preset.extraFee);
      setMdrBearer(preset.bearer);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await onSave({
        name,
        provider,
        environment,
        mdrBearer,
        extraFeePercent,
        keyId,
        keySecret,
        merchantId,
        webhookSecret,
        apiEndpoint,
        isActive,
      });
      if (ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add Payment Gateway</DialogTitle>
          <DialogDescription className="text-sm">
            Add a new payment gateway provider integration for rider wallet top-ups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Gateway Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RAZORPAY">Razorpay</SelectItem>
                  <SelectItem value="PHONEPE">PhonePe Business</SelectItem>
                  <SelectItem value="CASHFREE">Cashfree Payments</SelectItem>
                  <SelectItem value="EASEBUZZ">Easebuzz</SelectItem>
                  <SelectItem value="PAYU">PayU</SelectItem>
                  <SelectItem value="PAYTM">Paytm Business</SelectItem>
                  <SelectItem value="CUSTOM">Custom Gateway</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Display Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Razorpay"
                required
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Environment</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as Environment)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST">TEST (Sandbox)</SelectItem>
                  <SelectItem value="LIVE">LIVE (Production)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">MDR Fee Bearer</Label>
              <Select value={mdrBearer} onValueChange={(v) => setMdrBearer(v as MdrBearer)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RIDER">Rider Pays MDR</SelectItem>
                  <SelectItem value="MERCHANT">Merchant Absorbs MDR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">MDR Fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={extraFeePercent}
                onChange={(e) => setExtraFeePercent(parseFloat(e.target.value) || 0)}
                className="h-10"
              />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              API &amp; Credentials
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">API Key ID / App ID</Label>
                <Input
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="rzp_live_..."
                  className="h-10 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">API Key Secret</Label>
                <Input
                  type="password"
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="h-10 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Merchant ID</Label>
                <Input
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="M12345678"
                  className="h-10 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Webhook Secret</Label>
                <Input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  className="h-10 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">API Endpoint URL (Optional)</Label>
              <Input
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.gateway.com/v1"
                className="h-10 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Enable Gateway</Label>
              <p className="text-xs text-muted-foreground">
                Active gateways will immediately appear to riders on wallet top-up screen.
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              className="data-[state=unchecked]:bg-red-500 dark:data-[state=unchecked]:bg-red-600"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add Gateway'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
