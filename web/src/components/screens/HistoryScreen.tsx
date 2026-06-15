'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  CreditCard,
  Wallet,
  Gift,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Receipt,
  TrendingUp,
  Sparkles,
  Filter,
  Download,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useTransactions } from '@/hooks/useRiderData';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────

type FilterTab = 'All' | 'Credits' | 'Debits';
type BreakdownType = 'CHARGE' | 'TAX' | 'DISCOUNT' | 'PENALTY' | 'ADJUSTMENT';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  date: string;
  status: string;
  icon: typeof Wallet;
  iconColor: string;
  description?: string;
  breakdowns?: Array<{ label: string; amount: number; type: BreakdownType }>;
}

// ─── Breakdown Type Config ───────────────────────────────────────────────

const breakdownTypeConfig: Record<
  BreakdownType,
  { color: string; bg: string; label: string; prefix: string }
> = {
  CHARGE: { color: 'text-gray-700', bg: 'bg-gray-50', label: 'Charge', prefix: '' },
  TAX: { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Tax', prefix: '' },
  DISCOUNT: { color: 'text-green-700', bg: 'bg-green-50', label: 'Discount', prefix: '-' },
  PENALTY: { color: 'text-red-700', bg: 'bg-red-50', label: 'Penalty', prefix: '' },
  ADJUSTMENT: { color: 'text-blue-700', bg: 'bg-blue-50', label: 'Info', prefix: '' },
};

const statusConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof Clock }
> = {
  PENDING: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  APPROVED: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle2,
  },
  SUCCESS: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: CheckCircle2,
  },
  REJECTED: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
};

const fadeUp: Record<string, any> = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────

function getIconForPurpose(purpose: string) {
  switch (purpose) {
    case 'RENTAL_FEE':
      return CreditCard;
    case 'SECURITY_DEPOSIT':
      return ShieldCheck;
    case 'REWARD':
      return Gift;
    case 'TOP_UP':
      return TrendingUp;
    case 'PENALTY':
      return AlertTriangle;
    case 'ADJUSTMENT':
      return Receipt;
    default:
      return Wallet;
  }
}

function getIconColor(type: string) {
  const isCredit = type === 'CREDIT' || type === 'TOP_UP';
  return isCredit ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600';
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const { riderId } = useRiderSession();
  const { transactions, loading, refetch } = useTransactions(1, 50);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Map API data to local Transaction type
  const mappedTx: Transaction[] = transactions.map((tx) => {
    const isCredit = tx.type === 'CREDIT' || tx.type === 'TOP_UP';
    const Icon = getIconForPurpose(tx.purpose);
    return {
      id: tx.id,
      title: tx.description || tx.purpose,
      amount: tx.amount,
      type: isCredit ? 'CREDIT' : 'DEBIT',
      date: formatDate(tx.createdAt),
      status: tx.status,
      icon: Icon,
      iconColor: getIconColor(tx.type),
      description: tx.description || undefined,
      breakdowns: (tx.breakdowns || []).map((b) => ({
        label: b.label,
        amount: b.amount,
        type: (b.type as BreakdownType) || 'CHARGE',
      })),
    };
  });

  const filteredTransactions = useMemo(() => {
    return mappedTx.filter((tx) => {
      const matchesFilter =
        activeFilter === 'All' ||
        (activeFilter === 'Credits' && tx.type === 'CREDIT') ||
        (activeFilter === 'Debits' && tx.type === 'DEBIT');
      const matchesSearch =
        !searchQuery || tx.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery, mappedTx]);

  const totalCredits = useMemo(
    () =>
      mappedTx
        .filter((t) => t.type === 'CREDIT' && (t.status === 'APPROVED' || t.status === 'SUCCESS'))
        .reduce((sum, t) => sum + t.amount, 0),
    [mappedTx]
  );
  const totalDebits = useMemo(
    () =>
      mappedTx
        .filter((t) => t.type === 'DEBIT' && (t.status === 'APPROVED' || t.status === 'SUCCESS'))
        .reduce((sum, t) => sum + t.amount, 0),
    [mappedTx]
  );

  if (!riderId) {
    return (
      <div className="min-h-screen bg-vf-surface flex flex-col items-center justify-center p-6">
        <Zap className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-vf-surface pb-28">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="px-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('wallet')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Transaction History</h1>
        <button
          onClick={() => refetch()}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <RefreshCw size={16} className="text-vf-on-surface-variant" />
        </button>
      </div>

      <div className="px-5 space-y-4">
        {/* Summary Cards */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-2"
        >
          <div className="rounded-xl bg-white p-3 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-vf-on-surface-variant">
              Credits
            </p>
            <p className="mt-1 text-sm font-bold text-green-600">
              +₹{totalCredits.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-vf-on-surface-variant">
              Debits
            </p>
            <p className="mt-1 text-sm font-bold text-red-600">
              -₹{totalDebits.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-vf-on-surface-variant">
              Net
            </p>
            <p
              className={`mt-1 text-sm font-bold ${totalCredits - totalDebits >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              ₹{(totalCredits - totalDebits).toLocaleString('en-IN')}
            </p>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="relative"
        >
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-vf-outline" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions..."
            className="w-full rounded-xl bg-white py-3 pl-11 pr-4 text-sm text-vf-on-surface placeholder:text-vf-outline outline-none shadow-[0px_24px_48px_rgba(15,23,42,0.04)] focus:ring-2 focus:ring-[#0053c1]/20 transition"
          />
        </motion.div>

        {/* Filter Tabs + Export */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-2"
        >
          <div className="flex flex-1 gap-2">
            {(['All', 'Credits', 'Debits'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${
                  activeFilter === tab
                    ? 'bg-[#0053c1] text-white shadow-md'
                    : 'bg-white text-vf-on-surface-variant shadow-[0px_24px_48px_rgba(15,23,42,0.04)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)]">
            <Download size={16} className="text-vf-on-surface-variant" />
          </button>
        </motion.div>

        {/* Info hint */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5"
        >
          <Receipt size={14} className="text-blue-500 shrink-0" />
          <p className="text-[11px] text-blue-700">
            Tap any transaction to see the full fee breakdown
          </p>
        </motion.div>

        {/* Transaction List */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {filteredTransactions.map((tx) => {
            const Icon = tx.icon;
            const isCredit = tx.type === 'CREDIT';
            const isExpanded = expandedId === tx.id;
            const statusCfg = statusConfig[tx.status] || statusConfig.PENDING;
            const StatusIcon = statusCfg.icon;
            const hasBreakdown = tx.breakdowns && tx.breakdowns.length > 0;

            const taxes =
              tx.breakdowns?.filter((b) => b.type === 'TAX').reduce((s, b) => s + b.amount, 0) || 0;
            const discounts =
              tx.breakdowns
                ?.filter((b) => b.type === 'DISCOUNT')
                .reduce((s, b) => s + Math.abs(b.amount), 0) || 0;

            return (
              <div
                key={tx.id}
                className={`rounded-xl bg-white shadow-[0px_24px_48px_rgba(15,23,42,0.04)] overflow-hidden transition-shadow ${isExpanded ? 'ring-2 ring-[#0053c1]/20 shadow-md' : ''}`}
              >
                <button
                  onClick={() => hasBreakdown && toggleExpand(tx.id)}
                  className="flex items-center gap-3 w-full p-4 text-left"
                  disabled={!hasBreakdown}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${tx.iconColor}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-vf-on-surface truncate">{tx.title}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[11px] text-vf-on-surface-variant">{tx.date}</span>
                      <span className="text-[11px] text-vf-outline">|</span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${statusCfg.color}`}
                      >
                        <StatusIcon size={10} />
                        {tx.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {isCredit ? (
                        <ArrowDownCircle size={14} className="text-green-600" />
                      ) : (
                        <ArrowUpCircle size={14} className="text-red-500" />
                      )}
                      <span
                        className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-[#ba1a1a]'}`}
                      >
                        {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {hasBreakdown && (
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={16} className="text-vf-outline" />
                      </motion.div>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && hasBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {tx.description && (
                          <div className="px-4 pt-3 pb-2">
                            <p className="text-xs text-vf-on-surface-variant italic">
                              {tx.description}
                            </p>
                          </div>
                        )}
                        <div className="px-4 pb-3 space-y-1.5">
                          {tx.breakdowns!.map((item, i) => {
                            const bConfig = breakdownTypeConfig[item.type];
                            const isInfoOrZero = item.type === 'ADJUSTMENT' && item.amount === 0;
                            if (isInfoOrZero) {
                              return (
                                <div key={i} className="flex items-center gap-2 py-1">
                                  <span className="text-[10px] text-blue-600 italic">
                                    {item.label}
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={i}
                                className={`flex items-center justify-between rounded-lg px-3 py-2 ${bConfig.bg}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${bConfig.color} ${bConfig.bg}`}
                                  >
                                    {bConfig.label}
                                  </span>
                                  <span className={`text-xs font-medium ${bConfig.color}`}>
                                    {item.label}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs font-bold tabular-nums ${item.type === 'DISCOUNT' ? 'text-green-600' : bConfig.color}`}
                                >
                                  {item.type === 'DISCOUNT' ? '-' : ''}
                                  {item.type !== 'ADJUSTMENT' &&
                                  item.type !== 'DISCOUNT' &&
                                  item.amount > 0
                                    ? '₹'
                                    : ''}
                                  {item.amount.toLocaleString('en-IN', {
                                    minimumFractionDigits: item.amount % 1 !== 0 ? 2 : 0,
                                  })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="border-t border-gray-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-vf-on-surface-variant">
                              Total Charged
                            </span>
                            <div className="flex items-center gap-2">
                              {discounts > 0 && (
                                <span className="text-[10px] text-green-600 font-medium">
                                  Saved ₹{discounts}
                                </span>
                              )}
                              <span className="text-sm font-bold text-vf-on-surface">
                                ₹{tx.amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                          {taxes > 0 && (
                            <p className="mt-1 text-[10px] text-vf-on-surface-variant">
                              Includes ₹{taxes.toFixed(2)} in taxes
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Filter size={40} className="text-vf-outline mb-3" />
              <p className="text-sm font-semibold text-vf-on-surface-variant">
                No transactions found
              </p>
              <p className="mt-1 text-xs text-vf-outline">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <BottomNav activeTab="wallet" />
    </div>
  );
}
