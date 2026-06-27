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

export function BulkStatusModal({
  bulkStatusDialog, setBulkStatusDialog, selectedIds, bulkStatusValue: bulkStatusValue, setBulkStatusValue: setBulkStatusValue, handleBulkAction: handleBulkAction, bulkLoading
}: any) {
  return (
        <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status for {selectedIds.size} Vehicles</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkStatusValue}
                onClick={() => {
                  handleBulkAction('changeStatus', bulkStatusValue);
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

  );
}
