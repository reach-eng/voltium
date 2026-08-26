'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import type { Hub } from './types';

interface BulkActionDialogsProps {
  // Single delete
  deleteConfirm: string | null;
  setDeleteConfirm: (id: string | null) => void;
  onDelete: () => void;

  // Bulk delete
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  selectedCount: number;

  // Bulk status
  bulkStatusDialog: boolean;
  setBulkStatusDialog: (open: boolean) => void;
  bulkStatusValue: string;
  setBulkStatusValue: (value: string) => void;

  // Bulk hub
  bulkHubDialog: boolean;
  setBulkHubDialog: (open: boolean) => void;
  bulkHubValue: string;
  setBulkHubValue: (value: string) => void;
  hubs: Hub[];

  // Actions
  handleBulkAction: (action: string, value?: string) => void;
}

export function BulkActionDialogs({
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  bulkDeleteOpen,
  setBulkDeleteOpen,
  selectedCount,
  bulkStatusDialog,
  setBulkStatusDialog,
  bulkStatusValue,
  setBulkStatusValue,
  bulkHubDialog,
  setBulkHubDialog,
  bulkHubValue,
  setBulkHubValue,
  hubs,
  handleBulkAction,
}: BulkActionDialogsProps) {
  return (
    <>
      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedCount} Vehicle{selectedCount !== 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected vehicles? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBulkDeleteOpen(false);
                handleBulkAction('delete');
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Change Dialog */}
      <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {selectedCount} Vehicles</DialogTitle>
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

      {/* Bulk Hub Reassign Dialog */}
      <Dialog open={bulkHubDialog} onOpenChange={setBulkHubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Hub for {selectedCount} Vehicles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>New Hub</Label>
              <Select value={bulkHubValue} onValueChange={setBulkHubValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hub" />
                </SelectTrigger>
                <SelectContent>
                  {hubs.map((hub) => (
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
    </>
  );
}
