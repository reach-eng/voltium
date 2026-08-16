'use client';

import { ShieldAlert, Users, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { DetailGroup, MediaPreview } from '../helpers';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderGuarantorTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
  handleClearGuarantor: () => void;
}

export function RiderGuarantorTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
  handleClearGuarantor,
}: RiderGuarantorTabProps) {
  return (
    <TabsContent
      value="guarantor"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {rider.sharedGuarantorWith && rider.sharedGuarantorWith.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <div className="text-xs font-bold">
            Shared Backup Contact Risk: This contact phone is also linked to:{' '}
            {rider.sharedGuarantorWith.join(', ')}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <Users className="w-4 h-4" /> Personal Information
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <DetailGroup
              label="Full Name"
              value={isEditing ? editForm.guarantorName : rider.guarantorName}
              isEditing={isEditing}
              field="guarantorName"
              onEdit={(v) => setEditForm({ ...editForm, guarantorName: v })}
            />
            <DetailGroup
              label="Phone Number"
              value={
                isEditing ? editForm.guarantorPhone : rider.guarantorPhone
              }
              isEditing={isEditing}
              field="guarantorPhone"
              onEdit={(v) => setEditForm({ ...editForm, guarantorPhone: v })}
            />
            <DetailGroup
              label="Date of Birth"
              value={isEditing ? editForm.guarantorDob : rider.guarantorDob}
              isEditing={isEditing}
              field="guarantorDob"
              type="date"
              onEdit={(v) => setEditForm({ ...editForm, guarantorDob: v })}
            />
            <DetailGroup
              label="Father's Name"
              value={
                isEditing
                  ? editForm.guarantorFatherName
                  : rider.guarantorFatherName
              }
              isEditing={isEditing}
              field="guarantorFatherName"
              onEdit={(v) => setEditForm({ ...editForm, guarantorFatherName: v })}
            />
            <DetailGroup
              label="Mother's Name"
              value={
                isEditing
                  ? editForm.guarantorMotherName
                  : rider.guarantorMotherName
              }
              isEditing={isEditing}
              field="guarantorMotherName"
              onEdit={(v) => setEditForm({ ...editForm, guarantorMotherName: v })}
            />
            <DetailGroup
              label="Address"
              value={
                isEditing ? editForm.guarantorAddress : rider.guarantorAddress
              }
              isEditing={isEditing}
              field="guarantorAddress"
              onEdit={(v) => setEditForm({ ...editForm, guarantorAddress: v })}
            />
          </div>
          <div className="pt-4">
            <DetailGroup
              label="Verification Status"
              value={
                isEditing ? editForm.guarantorStatus : rider.guarantorStatus
              }
              isEditing={isEditing}
              field="guarantorStatus"
              type="select"
              options={['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED']}
              onEdit={(v) => setEditForm({ ...editForm, guarantorStatus: v })}
            />
          </div>
        </div>
        <div className="space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Visual Verification
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <MediaPreview
              src={rider.guarantorAadhaarFront}
              label="Aadhaar Front"
            />
            <MediaPreview
              src={rider.guarantorAadhaarBack}
              label="Aadhaar Back"
            />
            <MediaPreview src={rider.guarantorPan} label="PAN Card" />
            <MediaPreview src={rider.guarantorSignature} label="Signature" />
            <MediaPreview
              src={rider.guarantorPhoto}
              label="Guarantor Photo"
            />
          </div>
          <MediaPreview
            src={rider.guarantorVideo}
            label="Guarantor Video"
            type="video"
          />
        </div>
      </div>
      {rider.guarantorName && !isEditing && (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 h-8 px-3"
          onClick={handleClearGuarantor}
        >
          <Trash2 className="w-3 h-3 mr-1" /> Clear Guarantor
        </Button>
      )}
    </TabsContent>
  );
}
