'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileText,
  Camera,
  Clock,
  User,
  Bike,
  MapPin,
  Download,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

export interface Incident {
  id: string;
  incidentId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  riderId: string | null;
  riderName: string | null;
  vehicleId: string | null;
  vehicleNumber: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  hasInsurance: boolean;
  photos: string[];
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: { action: string; actor: string; timestamp: string }[];
}

interface IncidentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: Incident | null;
  detailTab: string;
  onTabChange: (tab: string) => void;
  onUpdateStatus: (id: string, newStatus: string) => void;
  onAssign: (id: string, adminIdentifier: string) => void;
  onGenerateReport: (incident: Incident) => void;
}

export function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'INVESTIGATING':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'RESOLVED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'CLOSED':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case 'LOW':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    case 'MEDIUM':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'HIGH':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'CRITICAL':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

function formatDate(dateStr: string) {
  return formatDateDDMMYYYY(dateStr);
}

export function IncidentDetailModal({
  open,
  onOpenChange,
  incident,
  detailTab,
  onTabChange,
  onUpdateStatus,
  onAssign,
  onGenerateReport,
}: IncidentDetailModalProps) {
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
              Incident #{incident?.incidentId}
            </span>
            {incident && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateReport(incident)}
              >
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {incident && (
          <Tabs value={detailTab} onValueChange={onTabChange} className="mt-4">
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
                  className={`rounded-md text-xs font-bold uppercase ${getStatusBadgeClass(incident.status)}`}
                >
                  {incident.status.replace('_', ' ')}
                </Badge>
                <Badge
                  variant="outline"
                  className={`rounded-md text-xs font-bold uppercase ${getSeverityBadgeClass(incident.severity)}`}
                >
                  {incident.severity}
                </Badge>
              </div>
              <h3 className="text-lg font-bold">{incident.title}</h3>
              <p className="text-sm text-muted-foreground">{incident.description}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{incident.type}</span>
                  </div>
                  {incident.riderName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> Rider
                      </span>
                      <span className="font-medium">{incident.riderName}</span>
                    </div>
                  )}
                  {incident.vehicleNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Bike className="w-3 h-3" /> Vehicle
                      </span>
                      <span className="font-medium">{incident.vehicleNumber}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {incident.location && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Location
                      </span>
                      <span className="font-medium">{incident.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Insurance</span>
                    <span className="font-medium">
                      {incident.hasInsurance ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(incident.createdAt)}</span>
                  </div>
                  {incident.resolvedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolved</span>
                      <span>{formatDate(incident.resolvedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              {incident.photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Camera className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No photos attached</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {incident.photos.map((photo, idx) => (
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
              {incident.timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Clock className="w-12 h-12 opacity-20" />
                  <p className="text-sm">No timeline entries</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incident.timeline.map((entry, idx) => (
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
                    {incident.status !== 'INVESTIGATING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(incident.id, 'INVESTIGATING')}
                      >
                        Start Investigating
                      </Button>
                    )}
                    {incident.status !== 'RESOLVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => onUpdateStatus(incident.id, 'RESOLVED')}
                      >
                        Mark Resolved
                      </Button>
                    )}
                    {incident.status !== 'CLOSED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(incident.id, 'CLOSED')}
                      >
                        Close
                      </Button>
                    )}
                    {incident.status !== 'OPEN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(incident.id, 'OPEN')}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Input
                    placeholder="Admin ID or name"
                    onBlur={(e) => {
                      if (e.target.value) onAssign(incident.id, e.target.value);
                    }}
                  />
                </div>
                {incident.assignedToName && (
                  <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Assigned to:{' '}
                      <span className="font-semibold">{incident.assignedToName}</span>
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
