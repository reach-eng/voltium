'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Undo2 } from 'lucide-react';
import type {
  AdminUser,
  RiderOption,
  LastBulkAction,
  NewTicketForm,
} from './types';

export interface TicketDialogsProps {
  // Bulk Status
  bulkStatusDialog: boolean;
  setBulkStatusDialog: (open: boolean) => void;
  bulkStatusValue: string;
  setBulkStatusValue: (val: string) => void;

  // Bulk Priority
  bulkPriorityDialog: boolean;
  setBulkPriorityDialog: (open: boolean) => void;
  bulkPriorityValue: string;
  setBulkPriorityValue: (val: string) => void;

  // Bulk Assign
  bulkAssignDialog: boolean;
  setBulkAssignDialog: (open: boolean) => void;
  bulkAssignValue: string;
  setBulkAssignValue: (val: string) => void;

  // Shared Bulk Props
  selectedIdsCount: number;
  handleBulkAction: (action: string, value?: string) => void;

  // Undo Toast
  showUndoToast: boolean;
  lastAction: LastBulkAction | null;
  bulkLoading: boolean;
  handleUndo: () => void;

  // Create Ticket Modal
  createModalOpen: boolean;
  setCreateModalOpen: (open: boolean) => void;
  newTicket: NewTicketForm;
  setNewTicket: (updater: (prev: NewTicketForm) => NewTicketForm) => void;
  isCreating: boolean;
  riders: RiderOption[];
  riderSearch: string;
  setRiderSearch: (search: string) => void;
  handleCreateTicket: (e: React.FormEvent) => void;

  // Admins
  admins: AdminUser[];
}

export function TicketDialogs({
  bulkStatusDialog,
  setBulkStatusDialog,
  bulkStatusValue,
  setBulkStatusValue,
  bulkPriorityDialog,
  setBulkPriorityDialog,
  bulkPriorityValue,
  setBulkPriorityValue,
  bulkAssignDialog,
  setBulkAssignDialog,
  bulkAssignValue,
  setBulkAssignValue,
  selectedIdsCount,
  handleBulkAction,
  showUndoToast,
  lastAction,
  bulkLoading,
  handleUndo,
  createModalOpen,
  setCreateModalOpen,
  newTicket,
  setNewTicket,
  isCreating,
  riders,
  riderSearch,
  setRiderSearch,
  handleCreateTicket,
  admins,
}: TicketDialogsProps) {
  return (
    <>
      {/* Bulk Status Dialog */}
      <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {selectedIdsCount} Tickets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
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

      {/* Bulk Priority Dialog */}
      <Dialog open={bulkPriorityDialog} onOpenChange={setBulkPriorityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Priority for {selectedIdsCount} Tickets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>New Priority</Label>
              <Select value={bulkPriorityValue} onValueChange={setBulkPriorityValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setBulkPriorityDialog(false);
                setBulkPriorityValue('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!bulkPriorityValue}
              onClick={() => {
                handleBulkAction('changePriority', bulkPriorityValue);
                setBulkPriorityDialog(false);
                setBulkPriorityValue('');
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignDialog} onOpenChange={setBulkAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedIdsCount} Tickets</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={bulkAssignValue} onValueChange={setBulkAssignValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
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
                setBulkAssignDialog(false);
                setBulkAssignValue('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!bulkAssignValue}
              onClick={() => {
                handleBulkAction('assign', bulkAssignValue);
                setBulkAssignDialog(false);
                setBulkAssignValue('');
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo Toast */}
      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <span className="text-sm">{lastAction.ids.length} ticket(s) updated</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 hover:bg-background/20 text-background"
            disabled={bulkLoading}
            onClick={handleUndo}
          >
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Create Ticket Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Manual Support Ticket</DialogTitle>
            <DialogDescription>Create a ticket on behalf of a rider.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Rider</Label>
              <Input
                placeholder="Search riders by name, phone or ID..."
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="mb-2"
              />
              <Select
                value={newTicket.riderDbId}
                onValueChange={(val) =>
                  setNewTicket((prev) => ({ ...prev, riderDbId: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a rider" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.fullName} ({r.riderId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newTicket.category}
                  onValueChange={(val) =>
                    setNewTicket((prev) => ({ ...prev, category: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    <SelectItem value="BILLING">Billing</SelectItem>
                    <SelectItem value="ACCIDENT">Accident</SelectItem>
                    <SelectItem value="APP_ISSUE">App Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(val) =>
                    setNewTicket((prev) => ({ ...prev, priority: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={newTicket.subject}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="Brief summary of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label>Message / Details</Label>
              <Textarea
                value={newTicket.message}
                onChange={(e) =>
                  setNewTicket((prev) => ({ ...prev, message: e.target.value }))
                }
                placeholder="Full details about the problem..."
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter className="mt-4 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
