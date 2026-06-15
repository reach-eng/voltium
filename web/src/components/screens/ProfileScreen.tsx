'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Smartphone,
  Shield,
  FileText,
  Gift,
  Users,
  Settings,
  ShieldCheck,
  Siren,
  LogOut,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  User as UserIcon,
  Zap,
  Check,
  Award,
  Gavel,
  AppWindow,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useRiderProfile } from '@/hooks/useRiderData';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

export default function ProfileScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const goBack = useAppStore((s) => s.goBack);
  const { riderId, clearRiderSession } = useRiderSession();
  const { rider: profile, loading } = useRiderProfile();
  const { logout: offlineLogout } = useOfflineSync();

  const handleLogout = () => {
    clearRiderSession();
    offlineLogout();
    useAppStore.setState({
      rider: {
        phone: '',
        kycStatus: 'PENDING',
        guarantorStatus: 'PENDING',
        walletBalance: 0,
        securityDeposit: 0,
        depositStatus: 'PENDING',
        paymentStreak: 0,
        planStatus: 'NONE',
        rentalStatus: 'NONE',
        registrationDone: true,
        depositDone: false,
        kycDone: false,
        planDone: false,
        pickupDone: false,
        accountStatus: 'PRE_ACTIVE',
      },
    });
    setScreen('permissions');
  };

  if (!riderId) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6">
        <Zap className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-[#1E293B] mb-2">Select a Rider</h2>
        <RiderSelector />
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] pb-28">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-20" />
        </div>
        <div className="px-5 space-y-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    );
  }

  const r = profile as any;
  const name = (r.fullName as string) || (r.name as string) || (r.riderId as string) || 'Member';
  const kycStatus = (r.kycStatus as string) || 'PENDING';
  const guarantorStatus = (r.guarantorStatus as string) || 'PENDING';
  const isVerified = kycStatus === 'APPROVED' || kycStatus === 'VERIFIED';

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28">
      {/* AppBar — 1:1 with Mobile */}
      <div className="flex items-center gap-4 px-5 pt-12 pb-4">
        <button
          onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0px_4px_10px_rgba(0,0,0,0.05)]"
        >
          <ArrowLeft size={20} className="text-[#1E293B]" />
        </button>
        <h1 className="text-[1.375rem] font-bold text-[#1E293B]">Profile</h1>
      </div>

      <div className="px-5 space-y-6">
        {/* Profile Card — 1:1 with Mobile */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center rounded-2xl bg-white py-8 px-4 shadow-[0px_4px_10px_rgba(0,0,0,0.02)]"
        >
          <div className="relative">
            <div
              className={`w-24 h-24 rounded-full overflow-hidden ${isVerified ? 'bg-[#10B981]' : 'bg-[#2563EB]'} flex items-center justify-center text-white text-[2.5rem] font-bold border-4 border-white shadow-xl`}
            >
              {r.profilePhoto ? (
                <img
                  src={r.profilePhoto as string}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>
            <div
              className={`absolute bottom-0 right-1 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white shadow-sm ${isVerified ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`}
            >
              {isVerified ? (
                <Check size={14} className="text-white" />
              ) : (
                <Clock size={14} className="text-white" />
              )}
            </div>
          </div>
          <h2 className="mt-4 text-[1.25rem] font-bold text-[#1E293B]">{name}</h2>
          <div className="mt-2 rounded-xl bg-[#F1F5F9] px-3 py-1 text-[0.6875rem] font-mono font-bold text-[#475569] uppercase tracking-wider">
            {(r.riderId as string) || 'NOT-ASSIGNED'}
          </div>
          <div
            className={`mt-2 flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${isVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-[#FFFBEB] border-[#FDE68A]'}`}
          >
            <Shield size={14} className={isVerified ? 'text-[#10B981]' : 'text-[#D97706]'} />
            <span
              className={`text-[0.75rem] font-bold ${isVerified ? 'text-[#10B981]' : 'text-[#D97706]'}`}
            >
              KYC: {kycStatus.charAt(0) + kycStatus.slice(1).toLowerCase()}
            </span>
          </div>
        </motion.div>

        {/* Personal Details — 1:1 with Mobile */}
        <div className="space-y-3">
          <h3 className="text-[0.75rem] font-black text-[#475569] uppercase tracking-wider">
            Personal Details
          </h3>
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-white p-4 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] space-y-4"
          >
            <DetailRow icon={UserIcon} label="Name" value={name} />
            <div className="h-px bg-[#F1F5F9]" />
            <DetailRow icon={Mail} label="Email" value={(r.email as string) || 'Not provided'} />
            <div className="h-px bg-[#F1F5F9]" />
            <DetailRow icon={Phone} label="Phone" value={(r.phone as string) || 'Not provided'} />
            <div className="h-px bg-[#F1F5F9]" />
            <DetailRow
              icon={Calendar}
              label="Date of Birth"
              value={(r.dob as string) || 'Not provided'}
            />
            <div className="h-px bg-[#F1F5F9]" />
            <DetailRow
              icon={Phone}
              label="Emergency Contact"
              value={(r.emergencyContact as string) || 'Not provided'}
            />
          </motion.div>
        </div>

        {/* Status Bentos — 1:1 with Mobile */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          <StatusTile label="KYC STATUS" status={kycStatus} />
          <StatusTile label="GUARANTOR" status={guarantorStatus} />
        </motion.div>

        {/* Guarantor Details */}
        {r.guarantorName && (
          <div className="space-y-3">
            <h3 className="text-[0.75rem] font-black text-[#475569] uppercase tracking-wider">
              Guarantor Information
            </h3>
            <motion.div
              custom={2.5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-2xl bg-white p-4 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-[#F1F5F9] border-2 border-white shadow-sm flex items-center justify-center">
                  {r.guarantorVideo ? ( // Re-using video as photo source if it's a thumbnail or if photo exists
                    <img
                      src={r.guarantorAadhaarFront as string}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon size={24} className="text-[#94A3B8]" />
                  )}
                </div>
                <div>
                  <p className="text-[0.875rem] font-bold text-[#1E293B]">
                    {r.guarantorName as string}
                  </p>
                  <p className="text-[0.75rem] text-[#64748B]">{r.guarantorPhone as string}</p>
                </div>
                <div className="ml-auto">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${guarantorStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}
                  >
                    {guarantorStatus}
                  </Badge>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Quick Links — 1:1 with Mobile */}
        <div className="space-y-3">
          <h3 className="text-[0.75rem] font-black text-[#475569] uppercase tracking-wider">
            Quick Links
          </h3>
          <div className="space-y-2">
            <QuickLinkItem
              id="editProfileLink"
              icon={FileText}
              label="Edit Profile"
              onClick={() => setScreen('edit_profile')}
              color="text-[#3B82F6] bg-[#EFF6FF]"
              delay={3}
            />
            <QuickLinkItem
              id="myDocumentsLink"
              icon={AppWindow}
              label="My Documents"
              onClick={() => setScreen('my_documents')}
              color="text-[#10B981] bg-[#ECFDF5]"
              delay={4}
            />
            <QuickLinkItem
              id="rewardsLink"
              icon={Award}
              label="Rewards"
              onClick={() => setScreen('rewards')}
              color="text-[#8B5CF6] bg-[#F5F3FF]"
              delay={5}
            />
            <QuickLinkItem
              id="referralLink"
              icon={Users}
              label="Referral Program"
              onClick={() => setScreen('referral_details')}
              color="text-[#F59E0B] bg-[#FFFBEB]"
              delay={6}
            />
            <QuickLinkItem
              id="appSettingsLink"
              icon={Settings}
              label="App settings"
              onClick={() => setScreen('settings')}
              color="text-[#64748B] bg-[#F1F5F9]"
              delay={6.5}
            />
            <QuickLinkItem
              id="legalLink"
              icon={Gavel}
              label="Legal"
              onClick={() => setScreen('legal_page')}
              color="text-[#0F766E] bg-[#CCFBF1]"
              delay={7}
            />
          </div>
        </div>

        {/* Emergency SOS — 1:1 with Mobile */}
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible">
          <button
            id="emergencySosLink"
            onClick={() => setScreen('emergency')}
            className="flex w-full items-center gap-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-4 transition-transform active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2]">
              <Siren size={22} className="text-[#DC2626]" />
            </div>
            <span className="flex-1 text-left text-[1rem] font-bold text-[#DC2626]">
              Emergency SOS
            </span>
            <ChevronRight size={20} className="text-[#EF4444]" />
          </button>
        </motion.div>

        {/* Logout Button — 1:1 with Mobile */}
        <motion.div custom={10} variants={fadeUp} initial="hidden" animate="visible">
          <button
            id="logoutButton"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-transparent py-4 text-[1rem] font-bold text-red-600 shadow-[0px_4px_10px_rgba(239,68,68,0.02)] transition-transform active:scale-[0.99] hover:bg-red-50"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </motion.div>
      </div>

      <BottomNav activeTab="profile" />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F5F9]">
        <Icon size={20} className="text-[#64748B]" />
      </div>
      <div className="flex-1">
        <p className="text-[0.6875rem] text-[#64748B]">{label}</p>
        <p className="text-[0.875rem] font-bold text-[#1E293B]">{value}</p>
      </div>
    </div>
  );
}

function StatusTile({ label, status }: { label: string; status: string }) {
  const isApproved = status === 'APPROVED' || status === 'VERIFIED';
  const color = isApproved ? 'text-[#10B981]' : 'text-[#DC2626]';
  const dotColor = isApproved ? 'bg-[#10B981]' : 'bg-[#DC2626]';

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0px_10px_20px_rgba(0,0,0,0.02)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-[0.625rem] font-black uppercase tracking-wider text-[#64748B]">
          {label}
        </span>
      </div>
      <p className={`text-[0.9375rem] font-bold ${color}`}>
        {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
      </p>
    </div>
  );
}

function QuickLinkItem({
  icon: Icon,
  label,
  onClick,
  color,
  id,
  delay,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  color: string;
  id?: string;
  delay: number;
}) {
  return (
    <motion.div custom={delay} variants={fadeUp} initial="hidden" animate="visible">
      <button
        id={id}
        onClick={onClick}
        className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 shadow-[0px_4px_10px_rgba(0,0,0,0.01)] transition-transform active:scale-[0.99]"
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${color}`}>
          <Icon size={22} />
        </div>
        <span className="flex-1 text-left text-[0.9375rem] font-bold text-[#1E293B]">{label}</span>
        <ChevronRight size={20} className="text-[#CBD5E1]" />
      </button>
    </motion.div>
  );
}
