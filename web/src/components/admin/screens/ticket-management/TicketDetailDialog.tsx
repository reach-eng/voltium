'use client';

import { Button } from '@/components/ui/button';
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
import { MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import { StatusBadge, PriorityBadge, STATUS_FLOW } from './helpers';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Ticket, TicketMessage, AdminUser } from './types';

export interface TicketDetailDialogProps {
  selectedTicket: Ticket | null;
  detailOpen: boolean;
  setDetailOpen: (open: boolean) => void;
  ticketMessages: TicketMessage[];
  messagesLoading: boolean;
  replyMessage: string;
  setReplyMessage: (msg: string) => void;
  replyLoading: boolean;
  handleSendReply: () => void;
  handleStatusChange: (status: string) => void;
  handleAssign: (adminId: string) => void;
  handleAssignToMe: () => void;
  admins: AdminUser[];
  getAssignedName: (adminId: string | null) => string;
}

export function TicketDetailDialog({
  selectedTicket,
  detailOpen,
  setDetailOpen,
  ticketMessages,
  messagesLoading,
  replyMessage,
  setReplyMessage,
  replyLoading,
  handleSendReply,
  handleStatusChange,
  handleAssign,
  handleAssignToMe,
  admins,
  getAssignedName,
}: TicketDetailDialogProps) {
  if (!selectedTicket) return null;

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ticket {selectedTicket.ticketId}
            <StatusBadge status={selectedTicket.status} />
            <PriorityBadge priority={selectedTicket.priority} />
          </DialogTitle>
          <DialogDescription>{selectedTicket.subject}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rider Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm">Rider Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>{' '}
                {selectedTicket.riderName}
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>{' '}
                {selectedTicket.riderPhone}
              </div>
              <div>
                <span className="text-muted-foreground">Category:</span>{' '}
                {selectedTicket.category}
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>{' '}
                {formatDateDDMMYYYY(selectedTicket.createdAt)}
              </div>
            </div>
          </div>

          {/* Initial Message */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Issue Description</h4>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
              {selectedTicket.message}
            </p>
          </div>

          {/* Message Thread */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Messages
            </h4>
            {messagesLoading ? (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
                Loading messages...
              </div>
            ) : ticketMessages.length === 0 ? (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
                No messages yet.
              </div>
            ) : (
              <div className="space-y-2">
                {ticketMessages.map((msg) => {
                  const isAdmin = msg.senderType === 'admin';
                  const senderName = isAdmin
                    ? getAssignedName(msg.senderId)
                    : selectedTicket.riderName;
                  return (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 ${isAdmin ? 'bg-primary/5 ml-6' : 'bg-muted/30 mr-6'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{senderName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reply Message Box */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="replyMessage" className="text-sm font-medium">
              Send Reply / Message
            </Label>
            <div className="flex flex-col gap-2">
              <Textarea
                id="replyMessage"
                placeholder="Type your message here..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={3}
                disabled={replyLoading || selectedTicket.status === 'CLOSED'}
              />
              <div className="flex justify-end">
                <Button
                  size="default"
                  className="h-10 px-5"
                  onClick={handleSendReply}
                  disabled={
                    replyLoading || !replyMessage.trim() || selectedTicket.status === 'CLOSED'
                  }
                >
                  {replyLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reply'
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Status & Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Update Status</label>
              <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign To</label>
              <div className="flex gap-2">
                <Select
                  value={selectedTicket.assignedTo || '_none'}
                  onValueChange={handleAssign}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Unassigned" />
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
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0"
                  onClick={handleAssignToMe}
                  title="Assign to Me"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDetailOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
