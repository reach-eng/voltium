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

export function BulkHubModal({
  bulkHubDialog, setBulkHubDialog, selectedIds, bulkHubValue: bulkHubValue, setBulkHubValue: setBulkHubValue, handleBulkAction, bulkLoading, hubs
}: any) {
  return (
        <Dialog open={bulkHubDialog} onOpenChange={setBulkHubDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Hub for {selectedIds.size} Vehicles</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Hub</Label>
                <Select value={bulkHubValue} onValueChange={setBulkHubValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.map((hub: any) => (
                      <SelectItem key={hub.id} value={hub.id}>
                        {hub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkHubDialog(false);
                  setBulkHubValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkHubValue}
                onClick={() => {
                  handleBulkAction('reassignHub', bulkHubValue);
                  setBulkHubDialog(false);
                  setBulkHubValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

  );
}
