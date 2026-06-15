'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Map,
  Phone,
  User,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  RefreshCw,
  Filter,
  Navigation,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/use-debounce';
import { Search } from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

interface FleetRider {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
  state: string;
  accountStatus: string;
  pickupHub: string | null;
  teamLeader: string | null;
  currentPlan: string | null;
  planStartDate: string | null;
  planEndDate: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationAt: string | null;
  batteryLevel: number | null;
  vehicle: {
    id: string;
    vehicleNumber: string;
    model: string;
    batteryLevel: number | null;
    status: string;
    hubName: string | null;
    hubCity: string | null;
  } | null;
}

interface HubOption {
  id: string;
  name: string;
  city: string;
}

function getBatteryIcon(level: number | null) {
  if (!level) return Battery;
  if (level < 20) return BatteryLow;
  if (level < 50) return BatteryMedium;
  return BatteryFull;
}

function getBatteryColor(level: number | null) {
  if (!level) return 'text-muted-foreground';
  if (level < 20) return 'text-rose-500';
  if (level < 50) return 'text-amber-500';
  return 'text-emerald-500';
}

function getRiderStatus(rider: FleetRider) {
  if (rider.accountStatus === 'SUSPENDED' || rider.accountStatus === 'BLACKLISTED')
    return 'offline';
  if (rider.state === 'POST_ACTIVE') return 'active';
  if (rider.state === 'PRE_ACTIVE') return 'idle';
  return 'offline';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500';
    case 'idle':
      return 'bg-amber-500';
    case 'offline':
      return 'bg-slate-400';
    default:
      return 'bg-slate-400';
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'idle':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'offline':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

export default function FleetMapScreen() {
  const [riders, setRiders] = useState<FleetRider[]>([]);
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedRider, setSelectedRider] = useState<FleetRider | null>(null);
  const [hubFilter, setHubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [lowBatteryOnly, setLowBatteryOnly] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (hubFilter !== 'ALL') params.set('hubId', hubFilter);
        if (statusFilter !== 'ALL') params.set('status', statusFilter);
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (lowBatteryOnly) params.set('lowBattery', 'true');

        const [fleetRes, hubsRes] = await Promise.all([
          fetch(`/api/admin/fleet?${params}`),
          fetch('/api/admin/hubs'),
        ]);

        if (fleetRes.ok) {
          const json = await fleetRes.json();
          setRiders(json.data?.riders || []);
        }
        if (hubsRes.ok) {
          const json = await hubsRes.json();
          setHubs(json.data || []);
        }
        setLastUpdated(new Date());
      } catch (error) {
        logger.error('Failed to fetch fleet data', { error });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hubFilter, statusFilter, debouncedSearch, lowBatteryOnly]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        fetchData(true);
        intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  const filteredRiders = riders.filter((r) => {
    const status = getRiderStatus(r);
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    if (lowBatteryOnly && (r.batteryLevel ?? 100) >= 20) return false;
    return true;
  });

  const activeCount = filteredRiders.filter((r) => getRiderStatus(r) === 'active').length;
  const idleCount = filteredRiders.filter((r) => getRiderStatus(r) === 'idle').length;
  const offlineCount = filteredRiders.filter((r) => getRiderStatus(r) === 'offline').length;
  const lowBatteryCount = filteredRiders.filter((r) => (r.batteryLevel ?? 100) < 20).length;

  const gridRiders = filteredRiders.filter((r) => r.lastKnownLat && r.lastKnownLng);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-[600px] rounded-2xl lg:col-span-1" />
          <Skeleton className="h-[600px] rounded-2xl lg:col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Map className="w-6 h-6 text-primary" />
            Fleet Map
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time rider locations and status
            {lastUpdated && (
              <>
                {' '}
                — Updated{' '}
                {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9"
          onClick={() => fetchData()}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Active</p>
              <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <BatteryLow className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Low Battery</p>
              <p className="text-2xl font-bold text-rose-600">{lowBatteryCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Idle</p>
              <p className="text-2xl font-bold text-amber-600">{idleCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-500/20 bg-slate-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Offline</p>
              <p className="text-2xl font-bold text-slate-600">{offlineCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden h-fit">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Search Rider</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, Phone, ID..."
                  className="pl-9 h-9 text-sm rounded-xl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Hub</Label>
              <Select value={hubFilter} onValueChange={setHubFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Hubs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Hubs</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.name}>
                      {hub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Low Battery Only</Label>
              <Switch checked={lowBatteryOnly} onCheckedChange={setLowBatteryOnly} />
            </div>
          </CardContent>
        </Card>

        {/* Grid Map */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden lg:col-span-3">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-base font-bold">
              Rider Grid — {gridRiders.length} with location
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {gridRiders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-2">
                <Map className="w-12 h-12 opacity-20" />
                <p>No riders with location data</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                {gridRiders.map((rider) => {
                  const status = getRiderStatus(rider);
                  const BatIcon = getBatteryIcon(rider.batteryLevel);
                  const batColor = getBatteryColor(rider.batteryLevel);
                  const isLowBattery = (rider.batteryLevel ?? 100) < 20;

                  return (
                    <button
                      key={rider.id}
                      onClick={() => setSelectedRider(rider)}
                      className={`relative group flex flex-col items-center justify-center p-2 rounded-xl border transition-all hover:scale-105 hover:shadow-md ${
                        isLowBattery
                          ? 'border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50'
                          : status === 'active'
                            ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                            : status === 'idle'
                              ? 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40'
                              : 'border-slate-500/20 bg-slate-500/5 hover:border-slate-500/40'
                      }`}
                      title={`${rider.fullName || rider.riderId} — ${status}`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${getStatusColor(status)} ${status === 'active' ? 'animate-pulse' : ''}`}
                      />
                      <BatIcon className={`w-3 h-3 mt-1 ${batColor}`} />
                      <span className="text-[9px] font-medium truncate w-full text-center mt-1">
                        {(rider.fullName || rider.riderId).split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rider Detail Dialog */}
      <Dialog
        open={!!selectedRider}
        onOpenChange={(o) => {
          if (!o) setSelectedRider(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedRider?.fullName || selectedRider?.riderId}
            </DialogTitle>
          </DialogHeader>
          {selectedRider &&
            (() => {
              const status = getRiderStatus(selectedRider);
              const BatIcon = getBatteryIcon(selectedRider.batteryLevel);
              const batColor = getBatteryColor(selectedRider.batteryLevel);
              return (
                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-md text-xs font-bold ${getStatusBadgeClass(status)}`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <span className={`flex items-center gap-1 text-sm font-semibold ${batColor}`}>
                      <BatIcon className="w-4 h-4" />
                      {selectedRider.batteryLevel ?? 'N/A'}%
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{selectedRider.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rider ID</span>
                      <span className="font-mono text-xs">{selectedRider.riderId}</span>
                    </div>
                    {selectedRider.vehicle && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vehicle</span>
                          <span className="font-medium">{selectedRider.vehicle.vehicleNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model</span>
                          <span>{selectedRider.vehicle.model}</span>
                        </div>
                      </>
                    )}
                    {selectedRider.pickupHub && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hub</span>
                        <span>{selectedRider.pickupHub}</span>
                      </div>
                    )}
                    {selectedRider.teamLeader && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Team Leader</span>
                        <span>{selectedRider.teamLeader}</span>
                      </div>
                    )}
                    {selectedRider.lastLocationAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Location</span>
                        <span className="text-xs">
                          {new Date(selectedRider.lastLocationAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      onClick={() => window.open(`tel:${selectedRider.phone}`)}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <User className="w-4 h-4 mr-2" />
                      View Profile
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
