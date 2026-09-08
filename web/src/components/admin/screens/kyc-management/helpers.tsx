'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, AlertCircle, ExternalLink } from 'lucide-react';
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
    // P3-1: Legacy alias for APPROVED; the state machine emits APPROVED, but
    // VERIFIED is preserved for display backward compatibility with historical records.
    VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    INFO_REQUIRED: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
    // NET-005 follow-up-13 (2026-09-08): add a
    // distinct EXPIRED badge. Pre-fix, EXPIRED rows
    // fell through to the default `border-border
    // text-muted-foreground bg-muted/30` (same as
    // UNKNOWN), so admins couldn't tell an expired
    // KYC from a row that had never been started.
    // Slate is distinct from every other status and
    // reads as "stale / needs re-submission".
    EXPIRED: 'border-slate-500/30 text-slate-600 bg-slate-500/5 dark:text-slate-400',
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
  const [open, setOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src)
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );

  // P3-3: Fallback when image fails to load or signed URL expired
  if (hasError) {
    return (
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </Label>
        <div className="aspect-video bg-muted/20 border border-dashed border-amber-500/30 rounded-2xl flex flex-col items-center justify-center p-3 text-center gap-1.5">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <span className="text-[11px] font-medium text-muted-foreground">Unable to preview</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            Open direct link <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </Label>
        <div
          className="aspect-video rounded-2xl border bg-black overflow-hidden relative group shadow-sm cursor-pointer"
          onClick={() => setOpen(true)}
        >
          {type === 'image' ? (
            <img
              src={src}
              alt={label}
              loading="lazy"
              decoding="async"
              onError={() => setHasError(true)}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <video
              src={src}
              controls
              onError={() => setHasError(true)}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-xl h-8 text-[10px] font-bold"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              View Full
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle className="text-lg font-bold">{label}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 flex items-center justify-center p-2 bg-black/5 rounded-xl border">
            {type === 'image' ? (
              <img
                src={src}
                alt={label}
                onError={() => setHasError(true)}
                className="max-w-full max-h-full object-contain rounded-lg shadow-md"
              />
            ) : (
              <video
                src={src}
                controls
                onError={() => setHasError(true)}
                className="max-w-full max-h-full rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
