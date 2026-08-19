'use client';

import { ShieldCheck, ShieldAlert, ShieldX, Trash2, X, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { DetailGroup, MediaPreview, getKycBadge } from '../helpers';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderKycDocsTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
  saving: boolean;
  selectedKycDocs: Set<string>;
  setSelectedKycDocs: (docs: Set<string>) => void;
  toggleKycDoc: (docKey: string) => void;
  handleDeleteKycDoc: (docKey: string) => void;
  handleBulkDeleteKycDocs: () => void;
  setConfirmKycAction: (
    action: { rider: Rider; action: 'approve' | 'reject' | 'info_required' } | null,
  ) => void;
}

export function RiderKycDocsTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
  saving,
  selectedKycDocs,
  setSelectedKycDocs,
  toggleKycDoc,
  handleDeleteKycDoc,
  handleBulkDeleteKycDocs,
  setConfirmKycAction,
}: RiderKycDocsTabProps) {
  return (
    <TabsContent
      value="kyc"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {selectedKycDocs.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
          <span className="text-xs font-medium text-destructive">
            {selectedKycDocs.size} document(s) selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive"
            disabled={saving}
            onClick={handleBulkDeleteKycDocs}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted/10"
            onClick={() => setSelectedKycDocs(new Set())}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-muted/20">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-xs uppercase font-black tracking-widest ${getKycBadge((rider.kycStatus as string) ?? 'PENDING')}`}
          >
            {rider.kycStatus ?? 'PENDING'}
          </Badge>
          {rider.kycRejectionReason && (
            <span className="text-xs text-muted-foreground">
              Reason: {rider.kycRejectionReason}
            </span>
          )}
        </div>
        {(rider.kycStatus === 'PENDING' ||
          rider.kycStatus === 'SUBMITTED' ||
          rider.kycStatus === 'INFO_REQUIRED') && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() =>
                setConfirmKycAction({ rider: rider, action: 'approve' })
              }
            >
              <ShieldCheck className="w-3 h-3 mr-1" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
              onClick={() =>
                setConfirmKycAction({ rider: rider, action: 'info_required' })
              }
            >
              <ShieldAlert className="w-3 h-3 mr-1" /> Needs Correction
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() =>
                setConfirmKycAction({ rider: rider, action: 'reject' })
              }
            >
              <ShieldX className="w-3 h-3 mr-1" /> Reject
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2">
          <MediaPreview
            src={rider.profilePhoto ?? null}
            label="Profile Photo"
            onDelete={() => handleDeleteKycDoc('profilePhoto')}
            selected={selectedKycDocs.has('profilePhoto')}
            onSelect={() => toggleKycDoc('profilePhoto')}
          />
          {isEditing && (
            <Input
              value={editForm.profilePhoto || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, profilePhoto: e.target.value })
              }
              placeholder="Profile photo URL"
              className="h-8 text-xs"
            />
          )}
        </div>

        <div className="space-y-2">
          <MediaPreview
            src={rider.riderPhoto ?? null}
            label="Rider Photo *"
            onDelete={() => handleDeleteKycDoc('riderPhoto')}
            selected={selectedKycDocs.has('riderPhoto')}
            onSelect={() => toggleKycDoc('riderPhoto')}
          />
          {isEditing && (
            <Input
              value={editForm.riderPhoto || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, riderPhoto: e.target.value })
              }
              placeholder="Rider photo URL"
              className="h-8 text-xs"
            />
          )}
        </div>

        <div className="space-y-2">
          <MediaPreview
            src={rider.riderVideo ?? null}
            label="Rider Video *"
            onDelete={() => handleDeleteKycDoc('riderVideo')}
            selected={selectedKycDocs.has('riderVideo')}
            onSelect={() => toggleKycDoc('riderVideo')}
          />
          {isEditing && (
            <Input
              value={editForm.riderVideo || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, riderVideo: e.target.value })
              }
              placeholder="Rider video URL"
              className="h-8 text-xs"
            />
          )}
        </div>

        <div className="space-y-2">
          <MediaPreview
            src={rider.signature ?? null}
            label="Rider Signature"
            onDelete={() => handleDeleteKycDoc('signature')}
            selected={selectedKycDocs.has('signature')}
            onSelect={() => toggleKycDoc('signature')}
          />
          {isEditing && (
            <Input
              value={editForm.signature || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, signature: e.target.value })
              }
              placeholder="Signature URL"
              className="h-8 text-xs"
            />
          )}
        </div>
        <div className="space-y-2">
          <MediaPreview
            src={rider.aadhaarFront ?? null}
            label="Aadhaar Front"
            onDelete={() => handleDeleteKycDoc('aadhaarFront')}
            selected={selectedKycDocs.has('aadhaarFront')}
            onSelect={() => toggleKycDoc('aadhaarFront')}
          />
          {isEditing && (
            <Input
              value={editForm.aadhaarFront || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, aadhaarFront: e.target.value })
              }
              placeholder="Aadhaar front URL"
              className="h-8 text-xs"
            />
          )}
        </div>
        <div className="space-y-2">
          <MediaPreview
            src={rider.aadhaarBack ?? null}
            label="Aadhaar Back"
            onDelete={() => handleDeleteKycDoc('aadhaarBack')}
            selected={selectedKycDocs.has('aadhaarBack')}
            onSelect={() => toggleKycDoc('aadhaarBack')}
          />
          {isEditing && (
            <Input
              value={editForm.aadhaarBack || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, aadhaarBack: e.target.value })
              }
              placeholder="Aadhaar back URL"
              className="h-8 text-xs"
            />
          )}
        </div>
        <div className="space-y-2">
          <MediaPreview
            src={rider.panCard ?? null}
            label="PAN Card"
            onDelete={() => handleDeleteKycDoc('panCard')}
            selected={selectedKycDocs.has('panCard')}
            onSelect={() => toggleKycDoc('panCard')}
          />
          {isEditing && (
            <Input
              value={editForm.panCard || ''}
              onChange={(e) => setEditForm({ ...editForm, panCard: e.target.value })}
              placeholder="PAN card URL"
              className="h-8 text-xs"
            />
          )}
        </div>
      </div>
      <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10">
        <div className="flex items-center gap-3 mb-6">
          <Building className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h4 className="text-lg font-black tracking-tight text-blue-900 dark:text-blue-200">
            Bank Details
          </h4>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <DetailGroup
            label="Bank Name"
            value={isEditing ? editForm.bankName : rider.bankName}
            isEditing={isEditing}
            field="bankName"
            onEdit={(v) => setEditForm({ ...editForm, bankName: v })}
          />
          <DetailGroup
            label="Account Number"
            value={isEditing ? editForm.accountNumber : rider.accountNumber}
            isEditing={isEditing}
            field="accountNumber"
            onEdit={(v) => setEditForm({ ...editForm, accountNumber: v })}
          />
          <DetailGroup
            label="IFSC Code"
            value={isEditing ? editForm.ifscCode : rider.ifscCode}
            isEditing={isEditing}
            field="ifscCode"
            onEdit={(v) => setEditForm({ ...editForm, ifscCode: v })}
          />
        </div>
      </div>
    </TabsContent>
  );
}
