'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bike, User, Ticket, Camera, Eye } from 'lucide-react';
import type { Vehicle } from './types';

interface VehicleHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedVehicle: Vehicle | null;
  vehicleHistory: {
    leases: any[];
    tickets: any[];
    returns: any[];
  };
  historyLoading: boolean;
}

export function VehicleHistoryDialog({
  open,
  onOpenChange,
  selectedVehicle,
  vehicleHistory,
  historyLoading,
}: VehicleHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-3xl border-none shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Bike className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">
                {selectedVehicle?.vehicleNumber}
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-mono">
                {selectedVehicle?.vehicleId} • {selectedVehicle?.model}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-muted/30 p-1 rounded-2xl h-12">
              <TabsTrigger value="history" className="rounded-xl">
                Ride History
              </TabsTrigger>
              <TabsTrigger value="tickets" className="rounded-xl">
                Service Tickets
              </TabsTrigger>
              <TabsTrigger value="inspection" className="rounded-xl">
                Latest Inspection
              </TabsTrigger>
            </TabsList>

            {/* Ride History */}
            <TabsContent value="history" className="space-y-4 animate-in fade-in duration-300">
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : vehicleHistory.leases.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <User className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">No ride history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicleHistory.leases.map((lease) => (
                    <div
                      key={lease.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-muted/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                          {lease.rider.fullName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{lease.rider.fullName}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">
                            {lease.rider.riderId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">
                          {new Date(lease.leaseDate).toLocaleDateString()}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[8px] uppercase tracking-widest bg-blue-500/5 text-blue-600 dark:text-blue-400"
                        >
                          {lease.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Service Tickets */}
            <TabsContent value="tickets" className="space-y-4 animate-in fade-in duration-300">
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : vehicleHistory.tickets.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Ticket className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">No service tickets for this vehicle</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicleHistory.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 rounded-2xl bg-muted/20 border border-muted/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          className={`text-[9px] uppercase tracking-widest ${
                            ticket.status === 'OPEN' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        >
                          {ticket.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {ticket.ticketId}
                        </span>
                      </div>
                      <p className="font-bold text-sm mb-1">{ticket.subject}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>By {ticket.rider.fullName}</span>
                        <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Latest Inspection */}
            <TabsContent
              value="inspection"
              className="space-y-6 animate-in fade-in duration-300"
            >
              {selectedVehicle?.returns?.[0] ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                      <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 mb-1">
                        Return Date
                      </p>
                      <p className="font-bold">
                        {new Date(selectedVehicle.returns[0].createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/30 border border-muted/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Status
                      </p>
                      <Badge className="bg-emerald-500 uppercase text-[9px]">
                        {selectedVehicle.returns[0].status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: 'Front', key: 'photoFront' },
                      { label: 'Back', key: 'photoBack' },
                      { label: 'Left', key: 'photoLeft' },
                      { label: 'Right', key: 'photoRight' },
                      { label: 'Speedo', key: 'photoSpeedometer' },
                    ].map((photo) => (
                      <div key={photo.key} className="space-y-1 text-center">
                        <div className="aspect-[3/4] rounded-xl border bg-muted overflow-hidden relative group/insp">
                          {selectedVehicle.returns?.[0]?.[photo.key] ? (
                            <>
                              <img
                                src={selectedVehicle.returns[0][photo.key]}
                                alt={photo.label}
                                className="w-full h-full object-cover transition-transform group-hover/insp:scale-125"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/insp:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-20">
                              <Camera className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                          {photo.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Camera className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">No inspection records available</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="px-8 py-6 bg-muted/20 border-t flex justify-end">
          <Button
            className="rounded-xl h-11 px-8 font-bold"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
