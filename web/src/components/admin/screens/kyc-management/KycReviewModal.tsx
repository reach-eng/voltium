import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, VideoOff, Shield } from 'lucide-react';
import { MediaPreview } from '../../media-preview';
import { KycRider, kycDocuments } from './KycReviewsTab';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

export function KycReviewModal({
  selectedRider,
  setSelectedRider,
  confirmAction,
  setConfirmAction,
  actionLoading,
  handleKycAction,
  rejectionReason,
  setRejectionReason,
  getKycBadge
}: any) {
  return (
    <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>KYC Documents - {selectedRider?.fullName}</DialogTitle>
              <DialogDescription>{selectedRider?.riderId}</DialogDescription>
            </DialogHeader>
            {selectedRider && (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
                {/* Profile Header */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shrink-0 bg-background">
                    {selectedRider.profilePhoto ? (
                      <img
                        src={selectedRider.profilePhoto}
                        alt=""
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
                  <div className="col-span-2 bg-background/50 rounded-lg p-3 border border-border/30">
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
                      <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-1">
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
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            All Complete ({total}/{total})
                          </Badge>
                        );
                      if (present === 0)
                        return (
                          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                            No Documents Uploaded (0/{total})
                          </Badge>
                        );
                      return (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
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
                          className={`text-[9px] font-bold uppercase px-1.5 py-1 rounded ${present ? 'bg-emerald-500/5 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
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
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Bank Details
                  </p>
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
                        {selectedRider.accountNumber || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                        IFSC Code
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {selectedRider.ifscCode || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guarantor Details */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Guarantor Verification
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Guarantor Info
                      </p>
                      <p className="text-sm font-medium">
                        {selectedRider.guarantorName || 'Not Linked'}
                      </p>
                      {selectedRider.guarantorPhone && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-mono">
                            {selectedRider.guarantorPhone}
                          </p>
                          {selectedRider.guarantorStatus === 'VERIFIED' ||
                          selectedRider.guarantorStatus === 'APPROVED' ||
                          selectedRider.guarantorStatus === 'SUBMITTED' ? (
                            <Badge
                              variant="outline"
                              className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 h-4 px-1.5"
                            >
                              Phone Verified
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[8px] bg-amber-500/10 text-amber-600 border-amber-500/20 h-4 px-1.5"
                            >
                              Unverified
                            </Badge>
                          )}
                        </div>
                      )}
                      {selectedRider.guarantorRelation && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedRider.guarantorRelation}
                        </p>
                      )}
                      {selectedRider.guarantorDob && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          DOB: {selectedRider.guarantorDob}
                        </p>
                      )}
                      {selectedRider.guarantorFatherName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Father: {selectedRider.guarantorFatherName}
                        </p>
                      )}
                      {selectedRider.guarantorMotherName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Mother: {selectedRider.guarantorMotherName}
                        </p>
                      )}
                      {selectedRider.guarantorAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Address: {selectedRider.guarantorAddress}
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] mt-2 ${getKycBadge(selectedRider.guarantorStatus)}`}
                      >
                        {selectedRider.guarantorStatus}
                      </Badge>

                      {selectedRider.sharedGuarantorWith?.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">
                            Shared Guarantor With
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedRider.sharedGuarantorWith.map((name: string, i: number) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[8px] bg-white border-amber-200 text-amber-700"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Registration
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

                  {/* Guarantor Documents */}
                  {selectedRider.guarantorName && (
                    <div className="grid grid-cols-1 gap-4 pt-2">
                      {[
                        {
                          label: 'Guarantor Aadhaar Front',
                          url: selectedRider.guarantorAadhaarFront,
                        },
                        {
                          label: 'Guarantor Aadhaar Back',
                          url: selectedRider.guarantorAadhaarBack,
                        },
                        { label: 'Guarantor PAN', url: selectedRider.guarantorPan },
                        { label: 'Guarantor Signature', url: selectedRider.guarantorSignature },
                        { label: 'Guarantor Photo', url: selectedRider.guarantorPhoto },
                      ].map((gdoc) => (
                        <MediaPreview key={gdoc.label} src={gdoc.url} label={gdoc.label} />
                      ))}

                      {/* Video Verification */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Guarantor Video Verification
                        </label>
                        <div className="aspect-video w-full rounded-xl border bg-black overflow-hidden flex items-center justify-center relative shadow-inner">
                          {selectedRider.guarantorVideo ? (
                            <video
                              src={selectedRider.guarantorVideo}
                              controls
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-white/40">
                              <VideoOff className="w-8 h-8" />
                              <span className="text-[10px] uppercase font-bold tracking-widest">
                                No Video Uploaded
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
  );
}
