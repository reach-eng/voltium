'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Users, MapPin, Search, Calendar, Clock, ArrowDownLeft, ArrowUpRight, PhoneMissed, ShieldAlert, Lock, Trash2, Key } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hasPermission } from '@/lib/auth';

interface Contact {
  name: string;
  phone: string;
  email?: string;
}

interface CallLog {
  name?: string;
  number: string;
  type: 'INCOMING' | 'OUTGOING' | 'MISSED';
  duration: number;
  timestamp: string;
}

interface LocationPing {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  timestamp: string;
  isMocked: boolean;
}

interface DeviceData {
  contacts: Contact[];
  callLogs: CallLog[];
  locations: LocationPing[];
  rider?: {
    isAdminLocked: boolean;
    lockPassword: string | null;
    isUninstallBlocked: boolean;
    isLocationMandatory: boolean;
    isAppsControlRestricted: boolean;
  };
}

export default function DeviceTrackingView({ riderId }: { riderId: string }) {
  const [data, setData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'contacts' | 'calls' | 'location'>('calls');
  const [searchQuery, setSearchQuery] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    action: string;
    extraData: any;
  }>({
    open: false,
    title: '',
    message: '',
    action: '',
    extraData: {}
  });

  const [session, setSession] = useState<any>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/admin/auth/me');
      if (res.ok) {
        const json = await res.json();
        setSession(json.data);
      }
    } catch (err) {
      logger.error('Failed to fetch admin session', { error: err });
    }
  };

  const fetchData = async () => {
    if (session && !hasPermission(session, 'device_tracking_view')) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/device-data`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      logger.error('Failed to fetch device data', { error: err });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSession();
    };
    init();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [riderId, session]);

  const handleSecurityAction = async (action: string, extra: any = {}) => {
    setIsActionPending(true);
    try {
      const res = await fetch('/api/admin/riders/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, riderId, ...extra }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `${action} triggered successfully`);
        setUnlockPasswordInput('');
        fetchData();
      } else {
        toast.error(json.error || `Failed to trigger ${action}`);
      }
    } catch (err) {
      logger.error(`Failed to trigger ${action}`, { error: err });
      toast.error(`System error while triggering ${action}`);
    } finally {
      setIsActionPending(false);
      setConfirmDialog(prev => ({ ...prev, open: false }));
    }
  };

  const triggerSecurityAction = (action: string, extra: any = {}) => {
    let title = 'Confirm Action';
    let message = `Are you sure you want to perform ${action}?`;

    switch (action) {
      case 'ADMIN_LOCK':
        title = 'Admin Override Lock';
        message = 'This will generate a one-time alphanumeric password and lockdown the device. Continue?';
        break;
      case 'UNLOCK_DEVICE':
        title = 'Unlock Device';
        message = 'Are you sure you want to remotely unlock this device? This will invalidate the current password.';
        break;
      case 'PERSIST_APP':
        const isAllowingUninstall = !(extra.enabled ?? true);
        title = isAllowingUninstall ? 'Allow Uninstall' : 'Restrict Uninstall';
        message = isAllowingUninstall
          ? 'Allow the rider to uninstall the app? This will lower fleet security.'
          : 'Restrict the rider from uninstalling the app?';
        break;
      case 'ENFORCE_LOCATION':
        const isAllowingGPS = !(extra.enabled ?? true);
        title = isAllowingGPS ? 'Allow GPS Toggle' : 'Enforce GPS';
        message = isAllowingGPS
          ? 'Allow the rider to disable GPS services on their device?'
          : 'Force GPS ON and prevent the rider from disabling it?';
        break;
      case 'RESTRICT_APPS_CONTROL':
        const isAllowingControl = !(extra.enabled ?? true);
        title = isAllowingControl ? 'Allow App Control' : 'Restrict App Control';
        message = isAllowingControl
          ? 'Allow the rider to force-stop apps or clear data?'
          : 'Prevent the rider from force-stopping the app or clearing its data?';
        break;
      case 'LOCK_DEVICE':
        title = 'Lock Device';
        message = 'Are you sure you want to remotely lock this device?';
        break;
      case 'FACTORY_RESET':
        title = 'Emergency Wipe';
        message = 'WARNING: This will permanently wipe all data and factory reset the device. This action cannot be undone. Are you absolutely sure?';
        break;
      case 'DISABLE_CAMERA':
        title = 'Disable Camera';
        message = 'This will prevent the rider from using any camera on the device. Continue?';
        break;
      case 'ENABLE_CAMERA':
        title = 'Enable Camera';
        message = 'Restore camera access for the rider?';
        break;
      case 'ENFORCE_PASSCODE':
        title = 'Enforce Passcode';
        message = 'This will require the rider to set a complex numeric passcode (min 4 digits). Continue?';
        break;
      case 'CHECK_LOCATION_INTEGRITY':
        title = 'Verify Location Integrity';
        message = 'Trigger a background check for mock locations and GPS spoofing?';
        break;
      default:
        title = action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
    }

    setConfirmDialog({
      open: true,
      title,
      message,
      action,
      extraData: extra
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
        <div className="w-12 h-12 rounded-full bg-muted mb-4" />
        <p className="text-sm font-medium tracking-tight">Syncing with user device...</p>
      </div>
    );
  }

  const filteredContacts = data?.contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  ) || [];

  if (session && !hasPermission(session, 'device_tracking_view')) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-rose-500/5 rounded-2xl border border-rose-500/20 text-rose-600">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-40" />
        <p className="text-lg font-bold">Access Denied</p>
        <p className="text-sm opacity-70">You do not have permission to view device telemetry.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
          {[
            { id: 'calls', label: 'Call Register', icon: Phone },
            { id: 'contacts', label: 'Contacts', icon: Users },
            { id: 'location', label: 'Live GPS', icon: MapPin },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeSubTab === tab.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[400px]">
          {activeSubTab === 'calls' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Recent Call Logs</h4>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {data?.callLogs.length || 0} Registered
                </Badge>
              </div>
              <div className="space-y-2">
                {data?.callLogs.map((call, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-card/50 hover:border-primary/30 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        call.type === 'INCOMING' ? 'bg-emerald-500/10 text-emerald-600' :
                        call.type === 'OUTGOING' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-rose-500/10 text-rose-600'
                      }`}>
                        {call.type === 'INCOMING' ? <ArrowDownLeft className="w-4 h-4" /> :
                         call.type === 'OUTGOING' ? <ArrowUpRight className="w-4 h-4" /> :
                         <PhoneMissed className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground/90">{call.name || call.number}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">{call.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                        <Clock className="w-3 h-3" />
                        {Math.floor(call.duration / 60)}m {call.duration % 60}s
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">
                        {new Date(call.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
                {(!data?.callLogs || data.callLogs.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
                    <Phone className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm font-bold">No call history synced</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'contacts' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search phonebook..."
                  className="pl-9 rounded-xl bg-muted/30 border-transparent focus:bg-background h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredContacts.map((contact, i) => (
                  <div key={i} className="p-3 rounded-xl border bg-card/50 flex flex-col gap-1">
                    <p className="text-xs font-bold text-foreground/90 truncate">{contact.name}</p>
                    <p className="text-[10px] font-bold text-primary">{contact.phone}</p>
                    {contact.email && <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>}
                  </div>
                ))}
              </div>
              {filteredContacts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
                    <Users className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-sm font-bold">No contacts found</p>
                  </div>
              )}
            </div>
          )}

          {activeSubTab === 'location' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">GPS Telemetry history</h4>
                <Badge className="bg-emerald-500 text-white border-0">Live Active</Badge>
              </div>
              <div className="aspect-video w-full rounded-2xl bg-muted/30 border-2 border-dashed border-muted flex flex-col items-center justify-center text-muted-foreground group">
                <MapPin className="w-10 h-10 mb-4 opacity-20 group-hover:scale-110 transition-transform duration-500 text-primary" />
                <p className="text-sm font-bold">Interactive Map Integration</p>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 mt-1">Real-time coordinates active</p>
              </div>
              <div className="space-y-2">
                {data?.locations.map((loc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-card/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-mono font-bold">{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</p>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                              Accuracy: {loc.accuracy?.toFixed(1) || '0'}m · Speed: {loc.speed || '0'} km/h
                            </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                          <p className="text-[10px] text-muted-foreground font-bold">
                            {new Date(loc.timestamp).toLocaleTimeString()}
                          </p>
                          {loc.isMocked && (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] h-4 py-0 px-1">
                              Mocked
                            </Badge>
                          )}
                      </div>
                  </div>
                ))}
                {(!data?.locations || data.locations.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40">
                      <p className="text-xs font-bold uppercase tracking-widest">Awaiting first GPS ping...</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Fleet Security Controls</h4>
          </div>
          {!hasPermission(session || {}, 'device_remote_control') ? (
            <div className="bg-muted/30 rounded-xl p-6 border border-dashed text-center">
               <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Administrative Privileges Required</p>
               <p className="text-[10px] text-muted-foreground/60 mt-1">You do not have permission to execute remote device commands.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className={`transition-colors border-dashed ${data?.rider?.isAdminLocked ? 'bg-amber-500/10 border-amber-500' : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data?.rider?.isAdminLocked ? 'bg-amber-500 text-white animate-pulse' : 'bg-amber-500/10 text-amber-600'}`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xs font-bold">Admin Override Lock</p>
                      {data?.rider?.isAdminLocked && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[8px] bg-amber-500 text-white border-0 font-black uppercase">LOCKED</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {data?.rider?.isAdminLocked
                        ? `Recovery Password: ${data.rider.lockPassword}`
                        : 'Lock device with a one-time alphanumeric password.'}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      variant={data?.rider?.isAdminLocked ? "secondary" : "outline"}
                      className="flex-1 text-[10px] font-bold uppercase tracking-widest h-8 border-amber-500/30 text-amber-600"
                      onClick={() => triggerSecurityAction('ADMIN_LOCK')}
                      disabled={isActionPending}
                    >
                      {data?.rider?.isAdminLocked ? 'Change Password' : 'Lock'}
                    </Button>
                    {data?.rider?.isAdminLocked && (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="relative">
                          <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <Input
                            placeholder="Recovery Code"
                            value={unlockPasswordInput}
                            onChange={(e) => setUnlockPasswordInput(e.target.value)}
                            className="h-8 pl-8 text-[10px] font-mono bg-background/50"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-[10px] font-bold uppercase tracking-widest h-8 bg-amber-500 text-white border-0 hover:bg-amber-600"
                          onClick={() => triggerSecurityAction('UNLOCK_DEVICE', { password: unlockPasswordInput })}
                          disabled={isActionPending}
                        >
                          Unlock
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-500/5 border-blue-500/20 border-dashed hover:bg-blue-500/10 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Badge className="p-0 border-0">
                      <Phone className="w-5 h-5" />
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Restrict Hardware</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Control camera and passcode policies.</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-[10px] font-bold uppercase tracking-widest h-8 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        onClick={() => triggerSecurityAction('DISABLE_CAMERA')}
                        disabled={isActionPending}
                      >
                        Off Cam
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-[10px] font-bold uppercase tracking-widest h-8 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        onClick={() => triggerSecurityAction('ENFORCE_PASSCODE')}
                        disabled={isActionPending}
                      >
                        Pass
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className={`w-full text-[10px] font-bold uppercase tracking-widest h-8 transition-all ${
                          data?.rider?.isUninstallBlocked 
                            ? 'bg-blue-500 text-white border-0 hover:bg-blue-600 hover:text-white shadow-sm' 
                            : 'border-blue-500/30 text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                        onClick={() => triggerSecurityAction('PERSIST_APP', { enabled: !data?.rider?.isUninstallBlocked })}
                        disabled={isActionPending}
                      >
                        {data?.rider?.isUninstallBlocked ? 'Uninstall not allowed' : 'Uninstall allowed'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-full text-[10px] font-bold uppercase tracking-widest h-8 transition-all ${
                          data?.rider?.isAppsControlRestricted 
                            ? 'bg-indigo-500 text-white border-0 hover:bg-indigo-600 hover:text-white shadow-sm' 
                            : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                        onClick={() => triggerSecurityAction('RESTRICT_APPS_CONTROL', { enabled: !data?.rider?.isAppsControlRestricted })}
                        disabled={isActionPending}
                      >
                        {data?.rider?.isAppsControlRestricted ? 'App control not allowed' : 'App control allowed'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-500/5 border-emerald-500/20 border-dashed hover:bg-emerald-500/10 transition-colors">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-600">Location Integrity</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Audit or enforce GPS persistence.</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[10px] font-bold uppercase tracking-widest h-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => triggerSecurityAction('CHECK_LOCATION_INTEGRITY')}
                      disabled={isActionPending}
                    >
                      Verify GPS
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`w-full text-[10px] font-bold uppercase tracking-widest h-8 transition-all ${
                        data?.rider?.isLocationMandatory 
                          ? 'bg-emerald-500 text-white border-0 hover:bg-emerald-600 hover:text-white shadow-sm' 
                          : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      onClick={() => triggerSecurityAction('ENFORCE_LOCATION', { enabled: !data?.rider?.isLocationMandatory })}
                      disabled={isActionPending}
                    >
                      {data?.rider?.isLocationMandatory ? 'GPS Locked' : 'GPS Unlocked'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-rose-500/5 border-rose-500/20 border-dashed hover:bg-rose-500/10 transition-colors col-span-full">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-rose-600">Emergency Factory Reset</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Wipe all device data. Use only in case of theft or total loss.</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="px-8 text-[10px] font-bold uppercase tracking-widest h-10 shadow-lg shadow-rose-500/20"
                    onClick={() => triggerSecurityAction('FACTORY_RESET')}
                    disabled={isActionPending}
                  >
                    {isActionPending ? 'Processing...' : 'Wipe Device'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-muted-foreground/80">
              {confirmDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl border-none bg-muted/50 hover:bg-muted font-bold uppercase text-[10px] tracking-widest h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSecurityAction(confirmDialog.action, confirmDialog.extraData)}
              className="rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105"
            >
              Confirm Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
