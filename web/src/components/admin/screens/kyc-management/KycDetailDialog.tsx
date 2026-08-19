'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shield, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { MediaPreview, kycDocuments } from './helpers';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { KycRider } from './types';

export interface KycDetailDialogProps {
  selectedRider: KycRider | null;
  setSelectedRider: (rider: KycRider | null) => void;
}

export function KycDetailDialog({
  selectedRider,
  setSelectedRider,
}: KycDetailDialogProps) {
  const [showPii, setShowPii] = useState(false);

  if (!selectedRider) return null;

  const maskString = (val?: string) => {
    if (!val) return '—';
    if (showPii) return val;
    if (val.length <= 4) return '••••';
    return `••••••••${val.slice(-4)}`;
  };

  return (
    <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>KYC Documents - {selectedRider.fullName}</DialogTitle>
          <DialogDescription>{selectedRider.riderId}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 flex-1 overflow-y-auto min-h-0 pr-2 no-scrollbar">
          {/* Profile Header */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shrink-0 bg-background">
              {selectedRider.profilePhoto ? (
                <img
                  src={selectedRider.profilePhoto}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground uppercase bg-muted">
                  {selectedRider.fullName?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">{selectedRider.fullName}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <p className="text-sm text-muted-foreground">{selectedRider.phone}</p>
                {selectedRider.emergencyContact && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="font-bold text-[10px] uppercase text-rose-500">
                      SOS:
                    </span>{' '}
                    {selectedRider.emergencyContact}
                  </p>
                )}
                {selectedRider.teamLeader && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <span className="font-bold text-[10px] uppercase text-blue-500">TL:</span>{' '}
                    {selectedRider.teamLeader}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Rider Personal Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Father's Name
              </p>
              <p className="text-sm font-medium">{selectedRider.fatherName || '—'}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Mother's Name
              </p>
              <p className="text-sm font-medium">{selectedRider.motherName || '—'}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Date of Birth
              </p>
              <p className="text-sm font-medium">{selectedRider.dob || '—'}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Aadhaar Number
              </p>
              <p className="text-sm font-medium font-mono">
                {selectedRider.aadhaarNumber ? maskString(selectedRider.aadhaarNumber) : '—'}
              </p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                PAN Number
              </p>
              <p className="text-sm font-medium font-mono">
                {selectedRider.panNumber ? maskString(selectedRider.panNumber) : '—'}
              </p>
            </div>
            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Address
              </p>
              <p className="text-sm font-medium">{selectedRider.currentAddress || '—'}</p>
            </div>
          </div>

          {/* Rejection Reason */}
          {selectedRider.kycRejectionReason &&
            (selectedRider.kycStatus === 'REJECTED' ||
              selectedRider.kycStatus === 'INFO_REQUIRED') && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 mb-4">
                <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-widest mb-1">
                  Rejection Reason
                </p>
                <p className="text-sm text-rose-700 dark:text-rose-400">
                  {selectedRider.kycRejectionReason}
                </p>
              </div>
            )}

          {/* Quality Check */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Document Quality
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const docs = kycDocuments.map((d) => ({
                  key: d.key,
                  present: !!selectedRider[d.key as keyof KycRider],
                }));
                const present = docs.filter((d) => d.present).length;
                const total = docs.length;
                if (present === total)
                  return (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                      All Complete ({total}/{total})
                    </Badge>
                  );
                if (present === 0)
                  return (
                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
                      No Documents Uploaded (0/{total})
                    </Badge>
                  );
                return (
                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
                    Missing {total - present} of {total} docs
                  </Badge>
                );
              })()}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {kycDocuments.map((doc) => {
                const present = !!selectedRider[doc.key as keyof KycRider];
                return (
                  <div
                    key={doc.key}
                    className={`text-[9px] font-bold uppercase px-1.5 py-1 rounded ${present ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}
                  >
                    {present ? '✓' : '✗'} {doc.label.split(' ')[0]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents Grid */}
          <div className="grid grid-cols-1 gap-4">
            {kycDocuments.map((doc) => {
              const imageUrl = selectedRider[doc.key as keyof KycRider] as string | null;

              return (
                <div key={doc.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {doc.label}
                    </label>
                    {imageUrl ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-[10px]"
                      >
                        PRESENT
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400 text-[10px]"
                      >
                        MISSING
                      </Badge>
                    )}
                  </div>
                  <MediaPreview src={imageUrl} label={doc.label} />
                </div>
              );
            })}
          </div>

          {/* Bank Details */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Bank Details
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[11px] rounded-lg"
                onClick={() => setShowPii((v) => !v)}
              >
                {showPii ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPii ? 'Hide PII' : 'Reveal PII'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                  Bank Name
                </p>
                <p className="text-sm font-medium">{selectedRider.bankName || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                  Account Number
                </p>
                <p className="text-sm font-medium font-mono">
                  {selectedRider.accountNumber ? maskString(selectedRider.accountNumber) : '—'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                  IFSC Code
                </p>
                <p className="text-sm font-medium font-mono">
                  {selectedRider.ifscCode ? maskString(selectedRider.ifscCode) : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Guarantor Details */}
          {selectedRider.guarantorName && selectedRider.guarantorName.trim().length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Guarantor Details
              </h4>
              <div className="bg-muted/30 rounded-xl p-3 border border-border/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                      Name
                    </p>
                    <p className="text-sm font-medium">{selectedRider.guarantorName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                      Phone
                    </p>
                    <p className="text-sm font-medium font-mono">
                      {selectedRider.guarantorPhone || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                      Status
                    </p>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selectedRider.guarantorStatus || '—'}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                      Address
                    </p>
                    <p className="text-sm font-medium">
                      {selectedRider.guarantorAddress || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Guarantor Documents Grid */}
              <div className="grid grid-cols-1 gap-4 pt-2">
                {[
                  { key: 'guarantorAadhaarFront', label: 'Guarantor Aadhaar Front' },
                  { key: 'guarantorAadhaarBack', label: 'Guarantor Aadhaar Back' },
                  { key: 'guarantorPan', label: 'Guarantor PAN Card' },
                  { key: 'guarantorPhoto', label: 'Guarantor Photo' },
                  { key: 'guarantorSignature', label: 'Guarantor Signature' },
                  { key: 'guarantorVideo', label: 'Guarantor Video', type: 'video' },
                ].map((doc) => {
                  const url = selectedRider[
                    doc.key as keyof typeof selectedRider
                  ] as string | null;
                  if (!url) return null;
                  return (
                    <div key={doc.key} className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {doc.label}
                      </label>
                      <MediaPreview
                        src={url}
                        label={doc.label}
                        type={(doc.type as any) || 'image'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Registration */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Registration Info
            </h4>
            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Registration Date
              </p>
              <p className="text-sm font-medium">
                {formatDateDDMMYYYY(selectedRider.createdAt)}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] mt-2 border-primary/20 text-primary bg-primary/5 dark:bg-primary/10 uppercase"
              >
                {selectedRider.lifecycleStatus}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
