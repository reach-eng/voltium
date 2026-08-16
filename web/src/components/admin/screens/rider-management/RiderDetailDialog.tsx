'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Edit,
  Phone,
  Mail,
  Lock,
  Unlock,
  Loader2,
  User,
  ShieldCheck,
} from 'lucide-react';
import type { Rider, RiderEditForm } from '@/lib/types/admin';
import { getKycBadge } from './helpers';
import {
  RiderProfileTab,
  RiderKycDocsTab,
  RiderGuarantorTab,
  RiderTLAssignmentTab,
  RiderInspectionTab,
  RiderJourneyTab,
  RiderMoneyTab,
  RiderPermissionsTab,
} from './detail';

/* ── Props ── */

export interface RiderDetailDialogProps {
  rider: Rider | null;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
  saving: boolean;
  onClose: () => void;

  // Handler functions
  handleUpdateRider: () => void;
  handleDeleteKycDoc: (docKey: string) => void;
  confirmDeleteKycDoc: () => void;
  handleBulkDeleteKycDocs: () => void;
  toggleKycDoc: (docKey: string) => void;
  handleKycAction: () => void;
  handleClearGuarantor: () => void;
  confirmClearGuarantorAction: () => void;
  handleTlAction: (riderId: string, action: 'approve' | 'reject') => void;

  // KYC doc selection
  selectedKycDocs: Set<string>;
  setSelectedKycDocs: (docs: Set<string>) => void;

  // KYC action confirmation state
  confirmKycAction: {
    rider: Rider;
    action: 'approve' | 'reject' | 'info_required';
  } | null;
  setConfirmKycAction: (
    action: { rider: Rider; action: 'approve' | 'reject' | 'info_required' } | null,
  ) => void;
  kycRejectionReason: string;
  setKycRejectionReason: (reason: string) => void;

  // Delete doc confirmation state
  deleteDocKey: string | null;
  setDeleteDocKey: (key: string | null) => void;

  // Clear guarantor confirmation state
  confirmClearGuarantor: boolean;
  setConfirmClearGuarantor: (confirm: boolean) => void;

  // Wallet
  showAdjustWallet: boolean;
  setShowAdjustWallet: (show: boolean) => void;
}

/* ── Main Component ── */

export function RiderDetailDialog({
  rider,
  isEditing,
  setIsEditing,
  editForm,
  setEditForm,
  saving,
  onClose,
  handleUpdateRider,
  handleDeleteKycDoc,
  confirmDeleteKycDoc,
  handleBulkDeleteKycDocs,
  toggleKycDoc,
  handleKycAction,
  handleClearGuarantor,
  confirmClearGuarantorAction,
  handleTlAction,
  selectedKycDocs,
  setSelectedKycDocs,
  confirmKycAction,
  setConfirmKycAction,
  kycRejectionReason,
  setKycRejectionReason,
  deleteDocKey,
  setDeleteDocKey,
  confirmClearGuarantor,
  setConfirmClearGuarantor,
  setShowAdjustWallet,
}: RiderDetailDialogProps) {
  function startEditing() {
    if (!rider) return;
    // Coerce Rider -> RiderEditForm (only the form fields matter)
    setEditForm({
      id: rider.id,
      fullName: rider.fullName,
      email: rider.email ?? '',
      phone: rider.phone,
      fatherName: (rider as any).fatherName ?? '',
      motherName: (rider as any).motherName ?? '',
      dob: (rider as any).dob ?? '',
      intent: (rider as any).intent ?? '',
      emergencyContact: (rider as any).emergencyContact ?? '',
      currentAddress: (rider as any).currentAddress ?? '',
      lifecycleStatus: (rider as any).lifecycleStatus ?? '',
    });
    setIsEditing(true);
  }

  return (
    <>
      {/* ── Rider Detail Dialog ── */}
      <Dialog
        open={!!rider}
        onOpenChange={(o) => {
          if (!o) {
            onClose();
          }
        }}
      >
        <DialogContent className="!max-w-[90vw] !w-[90vw] h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl bg-background/95 backdrop-blur-xl">
          <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">
                    {rider?.fullName || 'Rider Profile'}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                    {rider?.riderId} · {rider?.phone}
                    {rider?.sharedGuarantorWith &&
                      rider.sharedGuarantorWith.length > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-5 text-[8px] px-2 rounded-full animate-pulse"
                        >
                          Shared Backup Contact Risk
                        </Badge>
                      )}
                  </p>
                  {(rider?.fatherName ||
                    rider?.motherName ||
                    rider?.dob) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      {rider?.fatherName && (
                        <span>
                          Father:{' '}
                          <span className="font-semibold text-foreground">
                            {rider.fatherName}
                          </span>
                        </span>
                      )}
                      {rider?.motherName && (
                        <span>
                          Mother:{' '}
                          <span className="font-semibold text-foreground">
                            {rider.motherName}
                          </span>
                        </span>
                      )}
                      {rider?.dob && (
                        <span>
                          DOB:{' '}
                          <span className="font-semibold text-foreground">
                            {rider.dob}
                          </span>
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-xl h-10 px-5 gap-2 font-bold transition-all ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 border-none' : ''}`}
                  onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
                >
                  {isEditing ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {isEditing ? 'Editing Active' : 'Unlock to Edit'}
                </Button>
                <Badge
                  variant="outline"
                  className="h-10 px-4 rounded-xl bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2"
                >
                  <ShieldCheck className="w-3 h-3" /> Rider Details
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
            {rider && (
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-8 mb-8 bg-muted/30 p-1 rounded-2xl h-12 sticky top-0 z-10 backdrop-blur-md">
                  <TabsTrigger
                    value="profile"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Personal Info
                  </TabsTrigger>
                  <TabsTrigger value="kyc" className="rounded-xl font-bold text-[10px] uppercase">
                    ID Photos
                  </TabsTrigger>
                  <TabsTrigger
                    value="guarantor"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Guarantor Details
                  </TabsTrigger>
                  <TabsTrigger
                    value="inspection"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Vehicle Handover
                  </TabsTrigger>
                  <TabsTrigger
                    value="journey"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Account Steps
                  </TabsTrigger>
                  <TabsTrigger
                    value="money"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Money
                  </TabsTrigger>
                  <TabsTrigger
                    value="device"
                    className="rounded-xl font-bold text-[10px] uppercase"
                  >
                    Phone Access
                  </TabsTrigger>
                  <TabsTrigger value="ops" className="rounded-xl font-bold text-[10px] uppercase">
                    Work Details
                  </TabsTrigger>
                </TabsList>

                {/* ── Profile Tab ── */}
                <RiderProfileTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  handleTlAction={handleTlAction}
                />

                {/* ── KYC Media Tab ── */}
                <RiderKycDocsTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  saving={saving}
                  selectedKycDocs={selectedKycDocs}
                  setSelectedKycDocs={setSelectedKycDocs}
                  toggleKycDoc={toggleKycDoc}
                  handleDeleteKycDoc={handleDeleteKycDoc}
                  handleBulkDeleteKycDocs={handleBulkDeleteKycDocs}
                  setConfirmKycAction={setConfirmKycAction}
                />

                {/* ── Guarantor Tab ── */}
                <RiderGuarantorTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  handleClearGuarantor={handleClearGuarantor}
                />

                {/* ── Pickup Inspection Tab ── */}
                <RiderInspectionTab rider={rider} />

                {/* ── Lifecycle Tab ── */}
                <RiderJourneyTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />

                {/* ── Finance Tab ── */}
                <RiderMoneyTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  setShowAdjustWallet={setShowAdjustWallet}
                />

                {/* ── Device Tab ── */}
                <RiderPermissionsTab rider={rider} />

                {/* ── Ops Tab ── */}
                <RiderTLAssignmentTab
                  rider={rider}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </Tabs>
            )}
          </div>

          <DialogFooter className="px-8 py-6 bg-muted/20 border-t flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-2">
              {isEditing ? (
                <Unlock className="w-3 h-3 text-amber-500" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              {isEditing ? 'Editing Active' : 'View Only'}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                }}
                className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] tracking-widest"
              >
                Close
              </Button>
              {isEditing && (
                <Button
                  onClick={handleUpdateRider}
                  disabled={saving}
                  className="rounded-xl h-11 px-10 font-black uppercase text-[10px] tracking-widest bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-105"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </>
  );
}
