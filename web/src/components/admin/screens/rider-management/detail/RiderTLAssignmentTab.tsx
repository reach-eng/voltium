'use client';

import { Users, Bike } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { DetailGroup } from '../helpers';
import type { Rider, RiderEditForm } from '@/lib/types/admin';

export interface RiderTLAssignmentTabProps {
  rider: Rider;
  isEditing: boolean;
  editForm: RiderEditForm;
  setEditForm: (form: RiderEditForm | Partial<RiderEditForm>) => void;
}

export function RiderTLAssignmentTab({
  rider,
  isEditing,
  editForm,
  setEditForm,
}: RiderTLAssignmentTabProps) {
  return (
    <TabsContent
      value="ops"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="grid grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4" /> Hierarchy & Support
          </h4>
          <div className="space-y-4">
            <DetailGroup
              label="Assigned Team Leader"
              value={isEditing ? editForm.teamLeader : rider.teamLeader}
              isEditing={isEditing}
              field="teamLeader"
              onEdit={(v) => setEditForm({ ...editForm, teamLeader: v })}
            />
            <DetailGroup
              label="Assigned TL Name"
              value={
                isEditing ? editForm.assignedTlName : rider.assignedTlName
              }
              isEditing={isEditing}
              field="assignedTlName"
              onEdit={(v) => setEditForm({ ...editForm, assignedTlName: v })}
            />
            <DetailGroup
              label="Assigned TL Phone"
              value={
                isEditing ? editForm.assignedTlPhone : rider.assignedTlPhone
              }
              isEditing={isEditing}
              field="assignedTlPhone"
              onEdit={(v) => setEditForm({ ...editForm, assignedTlPhone: v })}
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
              label="Referred By"
              value={isEditing ? editForm.referredBy : rider.referredBy}
              isEditing={isEditing}
              field="referredBy"
              onEdit={(v) => setEditForm({ ...editForm, referredBy: v })}
            />
          </div>
        </div>
        <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Bike className="w-4 h-4" /> Hub Operations
          </h4>
          <div className="space-y-4">
            <DetailGroup
              label="Preferred Pickup Hub"
              value={isEditing ? editForm.pickupHub : rider.pickupHub}
              isEditing={isEditing}
              field="pickupHub"
              onEdit={(v) => setEditForm({ ...editForm, pickupHub: v })}
            />
            <DetailGroup
              label="Work Shift Preference"
              value={
                isEditing ? editForm.preferredShift : rider.preferredShift
              }
              isEditing={isEditing}
              field="preferredShift"
              onEdit={(v) => setEditForm({ ...editForm, preferredShift: v })}
            />
            <DetailGroup
              label="Delivery Partner ID"
              value={isEditing ? editForm.deliveryId : rider.deliveryId}
              isEditing={isEditing}
              field="deliveryId"
              onEdit={(v) => setEditForm({ ...editForm, deliveryId: v })}
            />
            <DetailGroup
              label="User Intent"
              value={isEditing ? editForm.intent : rider.intent}
              isEditing={isEditing}
              field="intent"
              onEdit={(v) => setEditForm({ ...editForm, intent: v })}
            />
            <DetailGroup
              label="Active Vehicle"
              value={isEditing ? editForm.activeVehicle : rider.activeVehicle}
              isEditing={isEditing}
              field="activeVehicle"
              onEdit={(v) => setEditForm({ ...editForm, activeVehicle: v })}
            />
            <DetailGroup
              label="Vehicle Model"
              value={
                isEditing
                  ? editForm.activeVehicleModel
                  : rider.activeVehicleModel
              }
              isEditing={isEditing}
              field="activeVehicleModel"
              onEdit={(v) => setEditForm({ ...editForm, activeVehicleModel: v })}
            />
          </div>
        </div>
      </div>
    </TabsContent>
  );
}
