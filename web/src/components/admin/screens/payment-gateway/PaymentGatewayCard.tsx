'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CreditCard, Zap, ShieldCheck, Edit3 } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentGateway, MdrBearer } from './usePaymentGateways';

interface Props {
  gateway: PaymentGateway;
  onToggleActive: (gateway: PaymentGateway, newStatus: boolean) => void;
  onToggleMdrBearer: (gateway: PaymentGateway, bearer: MdrBearer) => void;
  onEdit: (gateway: PaymentGateway) => void;
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
}: Props) {
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
            <span className="text-xs font-medium text-muted-foreground">
              {gateway.isActive ? 'Active' : 'Inactive'}
            </span>
            <Switch
              checked={gateway.isActive}
              onCheckedChange={(val) => onToggleActive(gateway, val)}
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
              {gateway.keyId ? `${gateway.keyId.substring(0, 10)}...` : 'Not set'}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs rounded-lg"
            onClick={() => onEdit(gateway)}
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
