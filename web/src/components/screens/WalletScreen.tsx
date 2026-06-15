'use client';

import { motion } from 'framer-motion';
import {
  Plus,
  ArrowDownToLine,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Wallet2,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useRiderProfile, useTransactions } from '@/hooks/useRiderData';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: (i || 0) * 0.08, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export default function WalletScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId } = useRiderSession();
  const { rider: profile, loading: profileLoading, refetch: refetchProfile } = useRiderProfile();
  const { transactions, loading: txLoading, refetch: refetchTx } = useTransactions(1, 20);
  const [filter, setFilter] = useState('All');

  const loading = profileLoading || txLoading;

  const filteredTx = useMemo(() => {
    if (filter === 'All') return transactions;
    return transactions.filter((tx) => {
      const txStatus = tx.status?.toUpperCase();
      const txPurpose = tx.purpose?.toUpperCase();
      const f = filter.toUpperCase();
      if (f === 'SECURITY') return txPurpose === 'SECURITY_DEPOSIT';
      if (f === 'RENT') return txPurpose === 'RENT_PAYMENT' || txPurpose === 'PLAN_UPGRADE';
      if (f === 'APPROVED') return txStatus === 'APPROVED' || txStatus === 'SUCCESS';
      if (f === 'REJECTED') return txStatus === 'REJECTED' || txStatus === 'FAILED';
      return txStatus === f || txPurpose === f;
    });
  }, [transactions, filter]);

  if (!riderId) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-6">
        <Wallet className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-[#1E293B] mb-2">Select a Rider</h2>
        <RiderSelector />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] pb-28">
        <div className="bg-[#1B60DA] px-5 pt-12 pb-8">
          <Skeleton className="h-7 w-28 bg-white/20" />
        </div>
        <div className="px-5 space-y-4 -mt-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  const balance = profile ? ((profile.walletBalance as number) ?? 0) : 0;
  const streak = profile ? (profile.paymentStreak as number) || 0 : 0;
  const deposit = profile ? (profile.securityDeposit as number) || 0 : 0;
  const isLargeDeposit = deposit > 2000;
  const isLowBalance = balance < 500; // Threshold example

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28">
      {/* AppBar — 1:1 with Mobile */}
      <div className="bg-[#1B60DA] px-5 pt-12 pb-8 flex items-center justify-between">
        <h1 className="text-[1.25rem] font-bold text-white">Wallet</h1>
        <button
          onClick={() => {
            refetchProfile();
            refetchTx();
          }}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="px-5 space-y-4 -mt-4 relative z-10">
        {/* Low Balance Banner — 1:1 with Mobile */}
        {isLowBalance && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 flex items-center gap-3"
          >
            <AlertTriangle className="text-[#F59E0B]" size={20} />
            <div className="flex-1">
              <p className="text-[0.875rem] font-bold text-[#92400E]">Action Required</p>
              <p className="text-[0.75rem] text-[#D97706]">Low Wallet Balance</p>
            </div>
            <div className="bg-[#FEF3C7] px-2.5 py-0.5 rounded-full text-[0.75rem] font-bold text-[#B45309]">
              1
            </div>
          </motion.div>
        )}

        {/* Balance Card — 1:1 with Mobile */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="relative overflow-hidden bg-gradient-to-br from-[#1B60DA] to-[#2F6DDE] rounded-[24px] p-6 text-white shadow-[0px_20px_40px_rgba(27,96,218,0.15)]"
        >
          {/* Decorative Circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -right-5 w-24 h-24 bg-white/5 rounded-full" />

          <div className="flex items-center gap-2 text-white/70 mb-2">
            <Wallet2 size={16} />
            <span className="text-[0.75rem] font-medium uppercase tracking-wider">
              Available Balance
            </span>
          </div>
          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-[1.75rem] font-light">₹</span>
            <span className="text-[2.25rem] font-extrabold tracking-tight">
              {balance.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[0.75rem] mb-2">
            <span className="text-white/70">PAYMENT STREAK</span>
            <span className="font-bold">{streak} day streak</span>
          </div>
          <div className="flex gap-1.5 h-2.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full ${i < streak ? 'bg-white' : 'bg-white/20'}`}
              />
            ))}
          </div>
          {streak > 0 && (
            <p className="text-[0.625rem] text-white/50 mt-2 uppercase font-bold tracking-wider">
              {streak} day streak! Keep going to unlock premium tiers.
            </p>
          )}
        </motion.div>

        {/* Security Deposit — 1:1 with Mobile */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          className="bg-white rounded-2xl p-4 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] border border-[#E2E8F0]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.625rem] font-black text-[#64748B] tracking-wider">
              SECURITY DEPOSIT
            </span>
            <div
              className={`px-2 py-1 rounded-lg text-[0.625rem] font-bold ${isLargeDeposit ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}
            >
              {isLargeDeposit ? 'Refundable' : 'Non-Refundable'}
            </div>
          </div>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-[1rem] text-[#1E293B]">₹</span>
            <span className="text-[1.5rem] font-extrabold text-[#1E293B]">
              {deposit.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="text-[0.75rem] text-[#64748B] leading-relaxed">
            {isLargeDeposit
              ? `Your first top-up of ₹${deposit} is refundable after 180 days of active service.`
              : `Amounts less than ₹2,000 are treated as account activation fees and are non-refundable.`}
          </p>
        </motion.div>

        {/* Action Buttons — 1:1 with Mobile */}
        <div className="flex gap-3">
          <ActionButton
            icon={Plus}
            label="Top Up"
            color="text-[#16A34A] bg-[#DCFCE7]"
            onClick={() => setScreen('top_up_purpose')}
          />
          <ActionButton
            icon={ArrowDownToLine}
            label="History"
            color="text-[#1B60DA] bg-[#EFF6FF]"
            onClick={() => setScreen('history')}
          />
        </div>

        {/* Recent Transactions — 1:1 with Mobile */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="bg-white rounded-[24px] p-5 shadow-[0px_4px_10px_rgba(0,0,0,0.02)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.875rem] font-bold text-[#191C1E]">Recent Transactions</h3>
            {/* Removed trash button as per report H6 */}
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
            {['All', 'Approved', 'Rejected', 'Rent', 'Security'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-[0.75rem] font-bold transition-all whitespace-nowrap ${filter === f ? 'bg-[#1B60DA] text-white' : 'bg-[#F1F5F9] text-[#64748B]'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredTx.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[0.8125rem] text-[#94A3B8] italic">No transactions found</p>
              </div>
            ) : (
              filteredTx.map((tx, i) => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        </motion.div>
      </div>
      <BottomNav activeTab="wallet" />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: any;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-white rounded-2xl h-16 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] flex items-center justify-center gap-3 transition-transform active:scale-[0.98]"
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-[0.875rem] font-bold text-[#191C1E]">{label}</span>
    </button>
  );
}

function TransactionRow({ tx }: { tx: any }) {
  const isCredit = tx.type === 'CREDIT' || tx.type === 'TOP_UP';
  const status = (tx.status || 'PENDING').toUpperCase();
  const purpose = (tx.purpose || '').toUpperCase();

  // Custom Color Logic based on requirements
  let statusColor = 'text-[#D97706] bg-[#FFFBEB]'; // Default Pending (Amber)

  if (status === 'REJECTED' || status === 'FAILED' || !isCredit) {
    statusColor = 'text-[#DC2626] bg-[#FEF2F2]'; // Red for Rejections & Deductions
  } else if (status === 'SUCCESS' || status === 'APPROVED') {
    if (purpose.includes('REWARD')) {
      statusColor = 'text-[#F59E0B] bg-[#FFFBEB]'; // Orange for Rewards
    } else if (purpose.includes('REFUND')) {
      statusColor = 'text-[#1B60DA] bg-[#EFF6FF]'; // Blue for Refunds
    } else if (tx.type === 'TOP_UP' || tx.type === 'CREDIT') {
      statusColor = 'text-[#16A34A] bg-[#DCFCE7]'; // Green for Top-ups
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] flex items-center justify-center text-[#64748B]">
        <Wallet size={18} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <p className="text-[0.875rem] font-bold text-[#1E293B]">{tx.description || tx.purpose}</p>
          {!isCredit && <ArrowUpRight size={12} className="text-[#DC2626]" />}
        </div>
        <p className="text-[0.6875rem] text-[#64748B]">
          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`text-[0.875rem] font-bold ${isCredit ? 'text-[#16A34A]' : 'text-[#1E293B]'}`}
        >
          {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
        </p>
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[0.625rem] font-black uppercase mt-1 ${statusColor}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
