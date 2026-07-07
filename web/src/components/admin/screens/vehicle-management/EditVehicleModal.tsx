import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, AlertTriangle, ShieldCheck, FileText, Wrench, Shield, CheckCircle, Plus, Bike, User, Ticket, Eye, Camera } from 'lucide-react';
import { Vehicle } from './index';

export function EditVehicleModal({
  editOpen, setEditOpen, selectedVehicle, form: form, setForm: setForm, handleEditVehicle, actionLoading, addEditError, setAddEditError, hubs
}: any) {
  return (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Vehicle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {addEditError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
                  {addEditError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Vehicle Number</Label>
                <Input
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hub</Label>
                <Select value={form.hubId} onValueChange={(v) => setForm({ ...form, hubId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No hubs found</div>
                    ) : (
                      hubs.map((hub: any) => (
                        <SelectItem key={hub.id} value={hub.id}>
                          {hub.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Battery Swapping Partner</Label>
                <Select
                  value={form.batteryPartner}
                  onValueChange={(v) => setForm({ ...form, batteryPartner: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Battery Smart">Battery Smart</SelectItem>
                    <SelectItem value="Sun Mobility">Sun Mobility</SelectItem>
                    <SelectItem value="Gogoro">Gogoro</SelectItem>
                    <SelectItem value="Voltup">Voltup</SelectItem>
                    <SelectItem value="Bounce Infinity">Bounce Infinity</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ASSIGNED">Assigned</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setAddEditError('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditVehicle} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

  );
}
