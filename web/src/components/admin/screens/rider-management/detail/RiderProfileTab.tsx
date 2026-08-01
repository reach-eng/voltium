'use client';

import { History, UserPlus, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { DetailGroup, STATE_FILTERS } from '../helpers';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderProfileTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
  handleTlAction: (riderId: string, action: 'approve' | 'reject') => void;
}

export function RiderProfileTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
  handleTlAction,
}: RiderProfileTabProps) {
  return (
    <TabsContent
      value="profile"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* High Priority Alerts */}
      {(rider.returnPending || rider.tlChangeRequested) && (
        <div className="space-y-3">
          {rider.returnPending && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <History className="w-5 h-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-rose-600">
                    Vehicle Return Pending
                  </p>
                  <p className="text-xs text-rose-500/70">
                    Rider has submitted photos for return approval.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-500/20 text-rose-600 hover:bg-rose-500/10"
              >
                Review Photos
              </Button>
            </div>
          )}
          {rider.tlChangeRequested && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-600">
                      TL Change Requested
                    </p>
                    <p className="text-xs text-amber-500/70">
                      Reason: {rider.tlChangeReason || 'No reason provided'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={() => handleTlAction(rider.id, 'reject')}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600"
                    onClick={() => handleTlAction(rider.id, 'approve')}
                  >
                    Approve Change
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <DetailGroup
          label="Full Name"
          value={isEditing ? editForm.fullName : rider.fullName}
          isEditing={isEditing}
          field="fullName"
          onEdit={(v) => setEditForm({ ...editForm, fullName: v })}
        />
        <DetailGroup
          label="Email Address"
          value={isEditing ? editForm.email : rider.email}
          isEditing={isEditing}
          field="email"
          onEdit={(v) => setEditForm({ ...editForm, email: v })}
        />
        <DetailGroup
          label="Phone Number"
          value={isEditing ? editForm.phone : rider.phone}
          isEditing={isEditing}
          field="phone"
          onEdit={(v) => setEditForm({ ...editForm, phone: v })}
        />
        <DetailGroup
          label="Father's Name"
          value={isEditing ? editForm.fatherName : rider.fatherName}
          isEditing={isEditing}
          field="fatherName"
          onEdit={(v) => setEditForm({ ...editForm, fatherName: v })}
        />
        <DetailGroup
          label="Mother's Name"
          value={isEditing ? editForm.motherName : rider.motherName}
          isEditing={isEditing}
          field="motherName"
          onEdit={(v) => setEditForm({ ...editForm, motherName: v })}
        />
        <DetailGroup
          label="Date of Birth"
          value={isEditing ? editForm.dob : rider.dob}
          isEditing={isEditing}
          field="dob"
          type="date"
          onEdit={(v) => setEditForm({ ...editForm, dob: v })}
        />
        <DetailGroup
          label="Intent"
          value={isEditing ? editForm.intent : rider.intent}
          isEditing={isEditing}
          field="intent"
          onEdit={(v) => setEditForm({ ...editForm, intent: v })}
        />
        <DetailGroup
          label="Emergency Contact"
          value={
            isEditing ? editForm.emergencyContact : rider.emergencyContact
          }
          isEditing={isEditing}
          field="emergencyContact"
          onEdit={(v) => setEditForm({ ...editForm, emergencyContact: v })}
        />
        <DetailGroup
          label="Lifecycle Status"
          value={isEditing ? editForm.lifecycleStatus : rider.lifecycleStatus}
          isEditing={isEditing}
          field="lifecycleStatus"
          type="select"
          options={STATE_FILTERS}
          onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
        />
      </div>

      <div className="col-span-2 space-y-2">
        <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
          <MapPin className="w-3 h-3" /> Current Address
        </div>
        {isEditing ? (
          <textarea
            value={editForm.currentAddress || ''}
            onChange={(e) =>
              setEditForm({ ...editForm, currentAddress: e.target.value })
            }
            className="w-full min-h-[100px] p-4 rounded-2xl border border-muted/50 bg-muted/5 text-sm focus:outline-none focus:ring-1 ring-primary/30 transition-all font-medium"
          />
        ) : rider.currentAddress ? (
          <p className="text-sm font-medium whitespace-pre-wrap">
            {rider.currentAddress}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">Not provided</p>
        )}
      </div>
    </TabsContent>
  );
}
