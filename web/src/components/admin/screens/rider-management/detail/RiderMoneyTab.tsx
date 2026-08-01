'use client';

import { Wallet, ShieldCheck, Calendar, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { getKycBadge } from '../helpers';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderMoneyTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
  setShowAdjustWallet: (show: boolean) => void;
}

export function RiderMoneyTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
  setShowAdjustWallet,
}: RiderMoneyTabProps) {
  return (
    <TabsContent
      value="money"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="p-10 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-center gap-3 mb-4 text-emerald-600">
            <Wallet className="w-6 h-6" />
            <Label className="text-xs font-black uppercase tracking-widest">
              Current Wallet Balance
            </Label>
          </div>
          <div className="flex items-center text-4xl font-black tracking-tighter justify-between">
            <div>
              <span className="text-emerald-500 opacity-50 mr-2">₹</span>
              <span>
                {(rider.walletBalance || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-emerald-500/20 text-emerald-600 hover:bg-emerald-50"
              onClick={() => setShowAdjustWallet(true)}
            >
              Adjust Balance
            </Button>
          </div>
        </div>
        <div className="p-10 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-500/5">
          <div className="flex items-center gap-3 mb-4 text-blue-600">
            <ShieldCheck className="w-6 h-6" />
            <Label className="text-xs font-black uppercase tracking-widest">
              Security Deposit Held
            </Label>
          </div>
          <div className="flex items-center text-4xl font-black tracking-tighter">
            <span className="text-blue-500 opacity-50 mr-2">₹</span>
            {isEditing ? (
              <Input
                type="number"
                value={editForm.securityDeposit || 0}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    securityDeposit: Number(e.target.value),
                  })
                }
                className="bg-transparent border-none text-4xl font-black h-auto p-0 focus-visible:ring-0 w-full"
              />
            ) : (
              <span>
                {(rider.securityDeposit || 0).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="p-6 rounded-3xl bg-muted/20 border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border shadow-sm">
            <Calendar className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
              Deposit Payment Status
            </p>
            {isEditing ? (
              <Select
                value={editForm.depositStatus || 'PENDING'}
                onValueChange={(v) => setEditForm({ ...editForm, depositStatus: v })}
              >
                <SelectTrigger className="bg-transparent border-none h-auto p-0 font-black text-lg focus:outline-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                  <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-black tracking-widest ${getKycBadge(rider.depositStatus)}`}
              >
                {rider.depositStatus}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1">
            Payment Streak
          </p>
          <div className="text-2xl font-black flex items-center justify-end gap-2 text-emerald-600">
            <Zap className="w-5 h-5 fill-emerald-600" />
            {rider.paymentStreak || 0}
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
