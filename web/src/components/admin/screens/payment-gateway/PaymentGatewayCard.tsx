'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CreditCard, Zap, ShieldCheck, Edit3, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentGateway, MdrBearer } from './usePaymentGateways';

interface Props {
  gateway: PaymentGateway;
  onToggleActive: (gateway: PaymentGateway, newStatus: boolean) => void;
  onToggleMdrBearer: (gateway: PaymentGateway, bearer: MdrBearer) => void;
  onEdit: (gateway: PaymentGateway) => void;
  // ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24 P1-1 — Test Connection action.
  // Returns ok/issues/checks from /api/admin/payment-gateways/:id/test-connection.
  onTestConnection: (
    gatewayId: string
  ) => Promise<{ ok: boolean; issues: string[]; checks?: Record<string, { ok: boolean; reason?: string }> }>;
}

/**
 * R3 split — single payment-gateway card. Renders the active/inactive state,
 * the MDR-bearer toggle, the key/merchant summary, and the edit button.
 * Extracted from PaymentGatewayManagement.tsx so the parent screen is
 * just a grid of cards.
 */
export function PaymentGatewayCard({
  gateway,
  onToggleActive,
  onToggleMdrBearer,
  onEdit,
  onTestConnection,
}: Props) {
  // ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24 P1-1 — Test Connection dialog
  // state. The card opens a small modal that shows the server's
  // check results (credentials / apiEndpoint / decrypt).
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    issues: string[];
    checks?: Record<string, { ok: boolean; reason?: string }>;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await onTestConnection(gateway.id);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all border-2 ${
        gateway.isActive
          ? 'border-primary/40 bg-card shadow-sm'
          : 'border-border/60 bg-muted/20 opacity-85'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                gateway.isActive
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                {gateway.name}
                <Badge
                  variant={gateway.environment === 'LIVE' ? 'default' : 'secondary'}
                  className="text-[10px] uppercase font-semibold px-2"
                >
                  {gateway.environment}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">ID: {gateway.id}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold ${
                gateway.isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {gateway.isActive ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={gateway.isActive}
              onCheckedChange={(val) => onToggleActive(gateway, val)}
              className="data-[state=unchecked]:bg-red-500 dark:data-[state=unchecked]:bg-red-600"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1 text-sm">
        {/* MDR Bearer Choice */}
        <div className="bg-muted/40 p-3 rounded-xl space-y-2 border border-border/40">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> MDR Fee Model
            </span>
            <span className="text-primary font-bold">{gateway.extraFeePercent}% Fee</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant={gateway.mdrBearer === 'RIDER' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9 font-medium rounded-lg"
              onClick={() => onToggleMdrBearer(gateway, 'RIDER')}
            >
              Rider pays MDR
            </Button>
            <Button
              type="button"
              variant={gateway.mdrBearer === 'MERCHANT' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-9 font-medium rounded-lg"
              onClick={() => onToggleMdrBearer(gateway, 'MERCHANT')}
            >
              I pay MDR
            </Button>
          </div>
        </div>

        {/* Key Attributes summary */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
          <div>
            <span className="font-semibold block text-foreground">Key / App ID</span>
            <span className="truncate block font-mono text-[11px]">
              {gateway.keyId ? `${gateway.keyId.substring(0, 4)}••••••••` : 'Not set'}
            </span>
          </div>
          <div>
            <span className="font-semibold block text-foreground">Merchant ID</span>
            <span className="truncate block font-mono text-[11px]">
              {gateway.merchantId || 'Not set'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {gateway.mdrBearer === 'RIDER' ? 'Surcharge added to Rider' : 'Merchant absorbs fee'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs rounded-lg"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs rounded-lg"
              onClick={() => onEdit(gateway)}
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit Details
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={!!testResult} onOpenChange={(open) => !open && setTestResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.ok ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Test passed
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" /> Test found issues
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {testResult?.ok
                ? 'Configuration check passed. The gateway credentials decrypt and the endpoint is a public HTTPS URL.'
                : 'Fix the following before enabling this gateway for riders:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {(testResult?.issues ?? []).map((issue, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <span className="text-foreground">{issue}</span>
              </div>
            ))}
            {testResult?.ok && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  All checks passed. The server can decrypt the stored secret, the API endpoint is a
                  public HTTPS URL, and the credentials are present.
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setTestResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
