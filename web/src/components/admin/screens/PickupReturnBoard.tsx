'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Camera, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PickupReturnBoard() {
  const [pickups] = useState([
    { id: 'p-1', rider: 'Rahul Patel', vehicle: 'V-1002', hub: 'Indiranagar Hub', time: '11:00 AM' },
    { id: 'p-2', rider: 'Priya Sharma', vehicle: 'V-1008', hub: 'HSR Layout Hub', time: '02:30 PM' },
  ]);

  const [returns] = useState([
    { id: 'r-1', rider: 'Aman Singh', vehicle: 'V-1005', hub: 'Indiranagar Hub', status: 'INSPECTION_PENDING' },
  ]);

  const handleStartInspection = (id: string, type: 'pickup' | 'return') => {
    toast.success(`Starting vehicle ${type} inspection checklist for ${id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pickup & Return Board</h2>
        <p className="text-muted-foreground">Manage today's scheduled pickups, vehicle returns, and field inspections.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Today's Pickups</CardTitle>
            <Badge variant="outline" className="bg-primary/5 text-primary">Pending Dispatch</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {pickups.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30">
                <div className="space-y-1">
                  <div className="font-semibold">{p.rider}</div>
                  <div className="text-xs text-muted-foreground">
                    Vehicle: <span className="font-bold">{p.vehicle}</span> | Hub: {p.hub}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-2">{p.time}</span>
                  <Button size="sm" className="gap-2" onClick={() => handleStartInspection(p.id, 'pickup')}>
                    <Camera className="h-4 w-4" /> Start Pickup
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Returns Queue</CardTitle>
            <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-200">Inspections Pending</Badge>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30">
                <div className="space-y-1">
                  <div className="font-semibold">{r.rider}</div>
                  <div className="text-xs text-muted-foreground">
                    Vehicle: <span className="font-bold">{r.vehicle}</span> | Hub: {r.hub}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="mr-2">PENDING</Badge>
                  <Button size="sm" variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5" onClick={() => handleStartInspection(r.id, 'return')}>
                    <Camera className="h-4 w-4" /> Start Return
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
