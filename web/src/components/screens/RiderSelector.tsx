'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRiderSession } from '@/store/riderSession';
import { useAppStore } from '@/store/app';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserCircle, ArrowRightLeft } from 'lucide-react';

interface RiderOption {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
  accountStatus: string;
  kycStatus: string;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: 'border-emerald-300 text-emerald-700 bg-emerald-50',
    PRE_ACTIVE: 'border-amber-300 text-amber-700 bg-amber-50',
    SUSPENDED: 'border-rose-300 text-rose-700 bg-rose-50',
    TERMINATED: 'border-gray-300 text-gray-700 bg-gray-50',
  };
  return styles[status] || 'border-gray-300 text-gray-700 bg-gray-50';
}

function getKycBadge(status: string) {
  const styles: Record<string, string> = {
    APPROVED: 'border-emerald-300 text-emerald-700 bg-emerald-50',
    VERIFIED: 'border-emerald-300 text-emerald-700 bg-emerald-50',
    SUBMITTED: 'border-blue-300 text-blue-700 bg-blue-50',
    PENDING: 'border-amber-300 text-amber-700 bg-amber-50',
    REJECTED: 'border-rose-300 text-rose-700 bg-rose-50',
  };
  return styles[status] || 'border-gray-300 text-gray-700 bg-gray-50';
}

export default function RiderSelector() {
  const { riderId, riderName, setRiderSession } = useRiderSession();
  const setRider = useAppStore((s) => s.setRider);
  const [open, setOpen] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/riders?limit=100');
      if (res.ok) {
        const json = await res.json();
        // The API returns { riders: [...], pagination: ..., flags: ... } in data
        const riderList = json.data?.riders || (Array.isArray(json.data) ? json.data : []);
        setRiders(riderList);
      }
    } catch (err) {
      console.error('Failed to fetch riders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRiders();
  }, [open, fetchRiders]);

  const filteredRiders = Array.isArray(riders)
    ? riders.filter(
        (r) =>
          (r.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.riderId || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.phone || '').includes(search)
      )
    : [];

  async function selectRider(rider: RiderOption) {
    setSelectedId(rider.id);
    const displayName = rider.fullName || rider.riderId;
    setRiderSession(rider.id, displayName);

    // Hydrate app store with full rider data from profile API
    try {
      const res = await fetch(`/api/rider/profile?riderId=${rider.id}`);
      if (res.ok) {
        const json = await res.json();
        const r = json.data;
        if (r) {
          setRider({
            id: r.id,
            riderId: r.riderId,
            phone: r.phone,
            fullName: r.fullName,
            email: r.email,
            fatherName: r.fatherName,
            dob: r.dob,
            profilePhoto: r.profilePhoto,
            riderPhoto: r.riderPhoto,
            signature: r.signature,
            kycStatus: r.kycStatus,
            aadhaarFront: r.aadhaarFront,
            aadhaarBack: r.aadhaarBack,
            panCard: r.panCard,
            bankAccount: r.bankAccount,
            bankIfsc: r.bankIfsc,
            bankName: r.bankName,
            guarantorName: r.guarantorName,
            guarantorRelation: r.guarantorRelation,
            guarantorPhone: r.guarantorPhone,
            guarantorStatus: r.guarantorStatus,
            walletBalance: r.walletBalance ?? r.balance ?? 0,
            securityDeposit: r.securityDeposit ?? 0,
            depositStatus: r.depositStatus,
            paymentStreak: r.paymentStreak ?? 0,
            planStatus: r.planStatus,
            currentPlan: r.currentPlan,
            planStartDate: r.planStartDate,
            planEndDate: r.planEndDate,
            rentalStatus: r.rentalStatus,
            assignedVehicle: r.assignedVehicle || r.vehicleId,
            pickupHub: r.pickupHub,
            teamLeader: r.teamLeader,
            emergencyContact: r.emergencyContact,
            registrationDone: r.registrationDone,
            depositDone: r.depositDone,
            kycDone: r.kycDone,
            planDone: r.planDone,
            pickupDone: r.pickupDone,
            accountStatus: r.accountStatus,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch full profile:', err);
    }

    setOpen(false);
    setSelectedId(null);
  }

  if (!riderId) return null;

  return (
    <>
      {/* Floating pill */}
      <div
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border rounded-full px-4 py-2 shadow-lg flex items-center gap-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(true)}
      >
        <UserCircle className="w-4 h-4 text-primary shrink-0" />
        <span className="text-muted-foreground text-xs hidden sm:inline">Viewing as:</span>
        <span className="font-medium truncate max-w-[120px]">{riderName}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {riders.find((r) => r.id === riderId)?.riderId}
        </span>
        <span className="text-primary text-xs">Change</span>
      </div>

      {/* Rider picker dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Switch Rider
            </DialogTitle>
            <DialogDescription>
              Select a rider to view the app as. This will load their real data.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or phone..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ScrollArea className="max-h-96">
            {loading ? (
              <div className="space-y-3 p-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRiders.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">No riders found</div>
            ) : (
              <div className="space-y-1 p-1">
                {filteredRiders.map((rider) => (
                  <button
                    key={rider.id}
                    onClick={() => selectRider(rider)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-accent/50 ${
                      rider.id === riderId ? 'border-primary bg-primary/5' : 'border-border'
                    } ${selectedId === rider.id ? 'opacity-70' : ''}`}
                    disabled={selectedId === rider.id}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {rider.fullName || 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-mono">{rider.riderId}</span>
                        <span>·</span>
                        <span>{rider.phone}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${getKycBadge(rider.kycStatus)}`}
                      >
                        {rider.kycStatus}
                      </Badge>
                    </div>
                    {rider.id === riderId && (
                      <div className="text-xs text-primary font-semibold shrink-0">Current</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
