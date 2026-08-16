'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Camera,
  Clock,
  User,
  Bike,
  MapPin,
  Download,
} from 'lucide-react';
import type { Incident } from './types';
import { getStatusBadgeClass, getSeverityBadgeClass, formatDate } from './helpers';

interface IncidentDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIncident: Incident | null;
  detailTab: string;
  setDetailTab: (tab: string) => void;
  onGenerateReport: (incident: Incident) => void;
  onUpdateStatus: (incidentId: string, status: string) => void;
  onAssign: (incidentId: string, adminId: string) => void;
}

export function IncidentDetailSheet({
  open,
  onOpenChange,
  selectedIncident,
  detailTab,
  setDetailTab,
  onGenerateReport,
  onUpdateStatus,
  onAssign,
}: IncidentDetailSheetProps) {
  // PR-VER-2026-08-06 (SUPPORT_INCIDENT P0-4): assignment used a free-text
  // <Input> with no validation — a typo'd admin id was persisted silently and
  // the ticket could never be claimed. Replace with a validated Select backed
  // by the real admin list.
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/admins?limit=100&page=1')
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const list = Array.isArray(body?.data) ? body.data : [];
        setAdmins(
          list.map((a: any) => ({
            id: a.id,
            name: a.name || a.email || a.id,
          }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Incident #{selectedIncident?.incidentId}
            </span>
            {selectedIncident && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateReport(selectedIncident)}
              >
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {selectedIncident && (
          <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-muted/30 p-1 rounded-xl">
              <TabsTrigger value="info" className="rounded-lg text-xs font-bold">
                Info
              </TabsTrigger>
              <TabsTrigger value="photos" className="rounded-lg text-xs font-bold">
                Photos
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-xs font-bold">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="actions" className="rounded-lg text-xs font-bold">
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`rounded-md text-xs font-bold uppercase ${getStatusBadgeClass(selectedIncident.status)}`}
                >
                  {selectedIncident.status.replace('_', ' ')}
                </Badge>
                <Badge
                  variant="outline"
                  className={`rounded-md text-xs font-bold uppercase ${getSeverityBadgeClass(selectedIncident.severity)}`}
                >
                  {selectedIncident.severity}
                </Badge>
              </div>
              <h3 className="text-lg font-bold">{selectedIncident.title}</h3>
              <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{selectedIncident.type}</span>
                  </div>
                  {selectedIncident.riderName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> Rider
                      </span>
                      <span className="font-medium">{selectedIncident.riderName}</span>
                    </div>
                  )}
                  {selectedIncident.vehicleNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Bike className="w-3 h-3" /> Vehicle
                      </span>
                      <span className="font-medium">{selectedIncident.vehicleNumber}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedIncident.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Location
                      </span>
                      <span className="font-medium">{selectedIncident.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Insurance</span>
                    <span className="font-medium">
                      {selectedIncident.hasInsurance ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(selectedIncident.createdAt)}</span>
                  </div>
                  {selectedIncident.resolvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolved</span>
                      <span>{formatDate(selectedIncident.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              {selectedIncident.photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Camera className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No photos attached</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {selectedIncident.photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="aspect-video rounded-xl border bg-muted overflow-hidden"
                    >
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {selectedIncident.timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Clock className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No timeline entries</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedIncident.timeline.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 pl-4 border-l-2 border-border"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div>
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-muted-foreground">
                          by {entry.actor} — {formatDate(entry.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <div className="flex gap-2 flex-wrap">
                    {selectedIncident.status !== 'INVESTIGATING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(selectedIncident.id, 'INVESTIGATING')}
                      >
                        Start Investigating
                      </Button>
                    )}
                    {selectedIncident.status !== 'RESOLVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => onUpdateStatus(selectedIncident.id, 'RESOLVED')}
                      >
                        Mark Resolved
                      </Button>
                    )}
                    {selectedIncident.status !== 'CLOSED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(selectedIncident.id, 'CLOSED')}
                      >
                        Close
                      </Button>
                    )}
                    {selectedIncident.status !== 'OPEN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(selectedIncident.id, 'OPEN')}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={selectedIncident.assignedTo ?? ''}
                    onValueChange={(value) => {
                      if (!value || assigning) return;
                      setAssigning(true);
                      onAssign(selectedIncident.id, value);
                      // The parent refetches/updates `selectedIncident`, so
                      // re-enable after a tick; a failed assignment keeps the
                      // previous value (the Select is controlled).
                      setTimeout(() => setAssigning(false), 500);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          admins.length === 0
                            ? 'Loading admins…'
                            : 'Select an admin to assign'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {admins.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No admins available
                        </div>
                      )}
                      {admins.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assignment is validated against the admin list — typos are
                    impossible.
                  </p>
                </div>
                {selectedIncident.assignedToName && (
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Assigned to:{' '}
                      <span className="font-semibold">{selectedIncident.assignedToName}</span>
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
