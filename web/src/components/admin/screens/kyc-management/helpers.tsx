'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import type { KycRider } from './types';

export const kycDocuments = [
  { key: 'aadhaarFront' as const, label: 'Aadhaar Front' },
  { key: 'aadhaarBack' as const, label: 'Aadhaar Back' },
  { key: 'panCard' as const, label: 'PAN Card' },
  { key: 'signature' as const, label: 'Signature' },
  { key: 'profilePhoto' as const, label: 'Rider Photo' },
];

export function getCompletion(rider: KycRider): number {
  const total = kycDocuments.length;
  const completed = kycDocuments.filter((doc) => rider[doc.key]).length;
  return Math.round((completed / total) * 100);
}

export function getKycBadge(status: string) {
  const styles: Record<string, string> = {
    APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    INFO_REQUIRED: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
  };
  return styles[status] || 'border-border text-muted-foreground bg-muted/30';
}

export function MediaPreview({
  src,
  label,
  type = 'image',
}: {
  src: string | null;
  label: string;
  type?: 'image' | 'video';
}) {
  if (!src)
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        {label}
      </Label>
      <div className="aspect-video rounded-2xl border bg-black overflow-hidden relative group shadow-sm">
        {type === 'image' ? (
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <video src={src} controls className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl h-8 text-[10px] font-bold"
            onClick={() => window.open(src, '_blank')}
          >
            View Full
          </Button>
        </div>
      </div>
    </div>
  );
}
