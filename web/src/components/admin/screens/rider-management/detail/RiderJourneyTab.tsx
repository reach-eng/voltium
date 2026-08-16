'use client';

import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { DetailGroup } from '../helpers';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderJourneyTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
}

export function RiderJourneyTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
}: RiderJourneyTabProps) {
  return (
    <TabsContent
      value="journey"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-primary">
            Sign-Up Steps
          </h4>
          <div className="space-y-3">
            {([
              {
                label: 'Registration',
                key: 'registrationDone' as const,
                dateKey: 'registrationDoneAt' as const,
              },
              { label: 'Deposit', key: 'depositDone' as const, dateKey: 'depositDoneAt' as const },
              { label: 'KYC', key: 'kycDone' as const, dateKey: 'kycDoneAt' as const },
              { label: 'Plan', key: 'planDone' as const, dateKey: 'planDoneAt' as const },
              { label: 'Pickup', key: 'pickupDone' as const, dateKey: 'pickedUpAt' as const },
            ] as const).map((step) => (
              <div
                key={step.key}
                className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-muted/50 group transition-all hover:bg-muted/30"
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black uppercase tracking-tight block">
                    {step.label}
                  </span>
                  <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">
                    System Flag
                  </span>
                  {rider[step.key] && rider[step.dateKey] && (
                    <span className="text-[9px] text-muted-foreground/50 block mt-0.5">
                      {formatDateDDMMYYYY(rider[step.dateKey])}
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditForm({ ...editForm, [step.key]: !editForm[step.key] })
                    }
                    className={`h-7 px-2 py-1 rounded-md text-[10px] font-bold ${editForm[step.key] ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400'}`}
                  >
                    {editForm[step.key] ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {editForm[step.key] ? 'Done' : 'Pending'}
                  </Button>
                ) : rider[step.key] ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500/20 w-fit gap-1 text-[10px]"
                  >
                    <Clock className="w-3 h-3" /> Pending
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-primary">
            Account Controls
          </h4>
          <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-8">
            <DetailGroup
              label="Lifecycle Status"
              value={
                isEditing ? editForm.lifecycleStatus : rider.lifecycleStatus
              }
              isEditing={isEditing}
              field="lifecycleStatus"
              type="select"
              options={['NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED']}
              onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
            />
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
