'use client';

import { Key, Lock, MapPin, Phone, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { hasPermission } from '@/lib/permissions';
import type { SessionPayload } from '@/lib/session-payload';
import type { DeviceRiderSettings, SecurityAction } from './types';

interface SecurityControlsProps {
  session: SessionPayload | null;
  rider: DeviceRiderSettings | undefined;
  busy: boolean;
  unlockPasswordInput: string;
  onUnlockPasswordChange: (v: string) => void;
  onTrigger: (action: SecurityAction, extra?: Record<string, unknown>) => void;
}

function LockedAdminCard({
  rider,
  busy,
  unlockPassword,
  onUnlockPasswordChange,
  onTrigger,
}: {
  rider: DeviceRiderSettings;
  busy: boolean;
  unlockPassword: string;
  onUnlockPasswordChange: (v: string) => void;
  onTrigger: (action: SecurityAction, extra?: Record<string, unknown>) => void;
}) {
  return (
    <Card
      className={`transition-colors border-dashed ${
        rider.isAdminLocked
          ? 'bg-amber-500/10 border-amber-500'
          : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
      }`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              rider.isAdminLocked
                ? 'bg-amber-500 text-white animate-pulse'
                : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs font-bold">Admin Override Lock</p>
              {rider.isAdminLocked && (
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[8px] bg-amber-500 text-white border-0 font-black uppercase"
                >
                  LOCKED
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {rider.isAdminLocked
                ? 'Device currently locked by administrator'
                : 'Lock device with a 12-digit numeric password.'}
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              size="default"
              variant={rider.isAdminLocked ? 'secondary' : 'outline'}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest h-11 border-amber-500/30 text-amber-600"
              onClick={() => onTrigger('ADMIN_LOCK')}
              disabled={busy}
            >
              {rider.isAdminLocked ? 'Change Password' : 'Lock'}
            </Button>
            {rider.isAdminLocked && (
              <div className="flex flex-col gap-2 w-full">
                <div className="relative">
                  <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                  <Input
                    placeholder="Recovery Code"
                    value={unlockPassword}
                    onChange={(e) => onUnlockPasswordChange(e.target.value)}
                    className="h-11 pl-8 text-[11px] font-mono bg-background/50"
                  />
                </div>
                <Button
                  size="default"
                  variant="outline"
                  className="w-full text-[10px] font-bold uppercase tracking-widest h-11 bg-amber-500 text-white border-0 hover:bg-amber-600"
                  onClick={() => onTrigger('UNLOCK_DEVICE', { password: unlockPassword })}
                  disabled={busy}
                >
                  Unlock
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RestrictHardwareCard({
  rider,
  busy,
  onTrigger,
}: {
  rider: DeviceRiderSettings;
  busy: boolean;
  onTrigger: (action: SecurityAction, extra?: Record<string, unknown>) => void;
}) {
  return (
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
            <p className="text-[10px] text-muted-foreground mt-1">
              Control camera and passcode policies.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2">
              <Button
                size="default"
                variant="outline"
                className="flex-1 text-[10px] font-bold uppercase tracking-widest h-11 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                onClick={() => onTrigger('DISABLE_CAMERA')}
                disabled={busy}
              >
                Off Cam
              </Button>
              <Button
                size="default"
                variant="outline"
                className="flex-1 text-[10px] font-bold uppercase tracking-widest h-11 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                onClick={() => onTrigger('ENFORCE_PASSCODE')}
                disabled={busy}
              >
                Pass
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="default"
                variant="outline"
                className={`w-full text-[10px] font-bold uppercase tracking-widest h-11 transition-all ${
                  rider.isUninstallBlocked
                    ? 'bg-blue-500 text-white border-0 hover:bg-blue-600 hover:text-white shadow-sm'
                    : 'border-blue-500/30 text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                }`}
                onClick={() =>
                  onTrigger('PERSIST_APP', { enabled: !rider.isUninstallBlocked })
                }
                disabled={busy}
              >
                {rider.isUninstallBlocked ? 'Uninstall not allowed' : 'Uninstall allowed'}
              </Button>
              <Button
                size="default"
                variant="outline"
                className={`w-full text-[10px] font-bold uppercase tracking-widest h-11 transition-all ${
                  rider.isAppsControlRestricted
                    ? 'bg-indigo-500 text-white border-0 hover:bg-indigo-600 hover:text-white shadow-sm'
                    : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
                onClick={() =>
                  onTrigger('RESTRICT_APPS_CONTROL', {
                    enabled: !rider.isAppsControlRestricted,
                  })
                }
                disabled={busy}
              >
                {rider.isAppsControlRestricted
                  ? 'App control not allowed'
                  : 'App control allowed'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LocationIntegrityCard({
  rider,
  busy,
  onTrigger,
}: {
  rider: DeviceRiderSettings;
  busy: boolean;
  onTrigger: (action: SecurityAction, extra?: Record<string, unknown>) => void;
}) {
  return (
    <Card className="bg-emerald-500/5 border-emerald-500/20 border-dashed hover:bg-emerald-500/10 transition-colors">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-600">Location Integrity</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Audit or enforce GPS persistence.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button
              size="default"
              variant="outline"
              className="w-full text-[10px] font-bold uppercase tracking-widest h-11 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              onClick={() => onTrigger('CHECK_LOCATION_INTEGRITY')}
              disabled={busy}
            >
              Verify GPS
            </Button>
            <Button
              size="default"
              variant="outline"
              className={`w-full text-[10px] font-bold uppercase tracking-widest h-11 transition-all ${
                rider.isLocationMandatory
                  ? 'bg-emerald-500 text-white border-0 hover:bg-emerald-600 hover:text-white shadow-sm'
                  : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              onClick={() =>
                onTrigger('ENFORCE_LOCATION', { enabled: !rider.isLocationMandatory })
              }
              disabled={busy}
            >
              {rider.isLocationMandatory ? 'GPS Locked' : 'GPS Unlocked'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FactoryResetCard({
  busy,
  onTrigger,
}: {
  busy: boolean;
  onTrigger: (action: SecurityAction, extra?: Record<string, unknown>) => void;
}) {
  return (
    <Card className="bg-rose-500/5 border-rose-500/30 hover:bg-rose-500/10 transition-all col-span-full relative overflow-hidden group hover:border-rose-500/60 shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-1 opacity-70 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#f43f5e_10px,#f43f5e_20px)] transition-opacity duration-300 group-hover:opacity-100" />
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-600">Emergency Factory Reset</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Wipe all device data. Use only in case of theft or total loss.
              </p>
            </div>
          </div>
          <Button
            size="default"
            variant="destructive"
            className="px-8 text-[11px] font-bold uppercase tracking-widest h-11 shadow-lg shadow-rose-500/20"
            onClick={() => onTrigger('FACTORY_RESET')}
            disabled={busy}
          >
            {busy ? 'Processing...' : 'Wipe Device'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NoPermissionCard() {
  return (
    <div className="bg-muted/30 rounded-xl p-6 border border-dashed text-center">
      <Lock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        Administrative Privileges Required
      </p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">
        You do not have permission to execute remote device commands.
      </p>
    </div>
  );
}

/**
 * R3.7bb split — Fleet Security Controls (4 cards).
 *
 *   - Admin Override Lock (with unlock code entry)
 *   - Restrict Hardware (camera, passcode, uninstall, app control)
 *   - Location Integrity (verify, enforce GPS)
 *   - Emergency Factory Reset
 *
 * If the admin session lacks `device_remote_control`, a no-permission
 * placeholder is shown instead.
 */
export function SecurityControls({
  session,
  rider,
  busy,
  unlockPasswordInput,
  onUnlockPasswordChange,
  onTrigger,
}: SecurityControlsProps) {
  if (!hasPermission(session ?? '', 'device_remote_control')) {
    return <NoPermissionCard />;
  }

  // Default flags so missing rider object doesn't break render
  const r: DeviceRiderSettings = rider || {
    isAdminLocked: false,
    lockPassword: null,
    isUninstallBlocked: false,
    isLocationMandatory: false,
    isAppsControlRestricted: false,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <LockedAdminCard
        rider={r}
        busy={busy}
        unlockPassword={unlockPasswordInput}
        onUnlockPasswordChange={onUnlockPasswordChange}
        onTrigger={onTrigger}
      />
      <RestrictHardwareCard rider={r} busy={busy} onTrigger={onTrigger} />
      <LocationIntegrityCard rider={r} busy={busy} onTrigger={onTrigger} />
      <FactoryResetCard busy={busy} onTrigger={onTrigger} />
    </div>
  );
}

// Suppress unused-import warning for ShieldAlert (kept for future use)
void ShieldAlert;
