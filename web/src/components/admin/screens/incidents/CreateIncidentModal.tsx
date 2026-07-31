'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface RiderOption {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
}

interface VehicleOption {
  id: string;
  vehicleNumber: string;
  model: string;
}

interface CreateIncidentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const incidentTypes = ['ACCIDENT', 'THEFT', 'BREAKDOWN', 'DAMAGE', 'VIOLATION', 'OTHER'];

export function CreateIncidentModal({ open, onOpenChange, onCreated }: CreateIncidentModalProps) {
  const [creating, setCreating] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  
  const [form, setForm] = useState({
    type: '',
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    title: '',
    description: '',
    riderId: '',
    vehicleId: '',
    location: '',
    hasInsurance: false,
  });

  useEffect(() => {
    if (open) {
      fetch('/api/admin/riders?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status !== 403) throw new Error('Failed to fetch');
          return null;
        })
        .then((json) => {
          if (json?.success) setRiders(json.data?.riders || []);
        })
        .catch(() => logger.error('Failed to fetch riders'));
        
      fetch('/api/admin/vehicles?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status !== 403) throw new Error('Failed to fetch');
          return null;
        })
        .then((json) => {
          if (json?.success) setVehicles(json.data?.vehicles || json.data || []);
        })
        .catch(() => logger.error('Failed to fetch vehicles'));
    }
  }, [open]);

  async function handleCreate() {
    if (!form.type || !form.title) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        severity: form.severity,
        title: form.title,
        description: form.description,
        location: form.location,
        hasInsurance: form.hasInsurance,
      };
      if (form.riderId) body.riderId = form.riderId;
      if (form.vehicleId) body.vehicleId = form.vehicleId;

      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to create incident');
        return;
      }
      toast.success('Incident created');
      onOpenChange(false);
      setForm({
        type: '',
        severity: 'MEDIUM',
        title: '',
        description: '',
        riderId: '',
        vehicleId: '',
        location: '',
        hasInsurance: false,
      });
      onCreated();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Create Incident
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Incident title"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => setForm({ ...form, severity: v as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })}
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
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rider (optional)</Label>
              <Select
                value={form.riderId}
                onValueChange={(v) => setForm({ ...form, riderId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rider" />
                </SelectTrigger>
                <SelectContent>
                  {riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.fullName || r.riderId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehicle (optional)</Label>
              <Select
                value={form.vehicleId}
                onValueChange={(v) => setForm({ ...form, vehicleId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicleNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Incident location"
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <Label className="text-sm">Insurance Claim</Label>
            <Switch
              checked={form.hasInsurance}
              onCheckedChange={(v) => setForm({ ...form, hasInsurance: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !form.type || !form.title}>
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
