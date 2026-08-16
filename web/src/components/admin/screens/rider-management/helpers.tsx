'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Trash2 } from 'lucide-react';
import { KYC_FILTERS, STATE_FILTERS } from './types';

export { STATE_FILTERS, KYC_FILTERS };

export function getStateBadge(state: string): string {
  const styles: Record<string, string> = {
    NEW: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
    PHONE_VERIFIED: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
    PROFILE_SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    KYC_SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    KYC_APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    GUARANTOR_SUBMITTED: 'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
    GUARANTOR_APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    DEPOSIT_PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    DEPOSIT_APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PLAN_SELECTED: 'border-indigo-500/20 text-indigo-600 bg-indigo-500/5 dark:text-indigo-400',
    PICKUP_SCHEDULED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    ACTIVE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    SUSPENDED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    RETURN_PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    CLOSED: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  };
  return (
    styles[state] ||
    'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
  );
}

export function getKycBadge(status: string): string {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
    case 'VERIFIED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'REJECTED':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    case 'INFO_REQUIRED':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'PENDING':
    case 'SUBMITTED':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export const PERMISSIONS = [
  { key: 'locationGranted', label: 'Location' },
  { key: 'batteryGranted', label: 'Battery' },
  { key: 'contactsGranted', label: 'Contacts' },
  { key: 'callLogsGranted', label: 'Call Logs' },
  { key: 'micGranted', label: 'Microphone' },
  { key: 'cameraGranted', label: 'Camera' },
  { key: 'phoneGranted', label: 'Phone' },
] as const;

interface DetailGroupProps {
  label: string;
  value: string | number | null | undefined;
  isEditing?: boolean;
  field?: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  onEdit?: (val: string) => void;
}

export function DetailGroup({
  label,
  value,
  isEditing,
  options,
  onEdit,
  type = 'text',
}: DetailGroupProps) {
  return (
    <div className="space-y-1.5 flex-1">
      <p className="text-[10px] items-center font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
        {label}
      </p>
      {isEditing && onEdit ? (
        type === 'select' && options ? (
          <select
            value={String(value ?? '')}
            onChange={(e) => onEdit(e.target.value)}
            className="w-full bg-background border border-border/50 rounded-lg h-9 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o.replace('_', ' ')}
              </option>
            ))}
          </select>
        ) : (
          <Input
            type={type}
            value={String(value ?? '')}
            onChange={(e) => onEdit(e.target.value)}
            className="h-9 text-sm bg-background border-border/50 focus:border-primary/50 transition-all"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        )
      ) : (
        <p title={String(value ?? '')} className="text-sm font-semibold text-foreground truncate min-h-[1.25rem]">
          {value || (
            <span className="text-muted-foreground/30 font-normal italic">Not provided</span>
          )}
        </p>
      )}
    </div>
  );
}

export const MediaPreview = ({
  src,
  label,
  type = 'image',
  onDelete,
  selected,
  onSelect,
}: {
  src: string | null;
  label: string;
  type?: 'image' | 'video';
  onDelete?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) => {
  if (!src)
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {onSelect && (
            <Checkbox checked={selected} onCheckedChange={onSelect} className="h-3 w-3" />
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              onClick={onDelete}
              title={`Delete ${label}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {type === 'video' ? (
        <video src={src} controls className="w-full rounded-xl" />
      ) : (
        <img
          src={src}
          alt={label}
          className="w-full aspect-video object-cover rounded-xl border border-muted/50"
        />
      )}
    </div>
  );
};
