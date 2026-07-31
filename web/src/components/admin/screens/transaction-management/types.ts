import { formatDateDDMMYYYY } from '@/lib/date-utils';

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  purpose: string;
  method: string | null;
  status: string;
  reason: string | null;
  remark: string | null;
  description: string | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  proofUrl: string | null;
  breakdowns?: Array<{ item: string; amount: number; id: string }>;
  rider?: {
    id: string;
    riderId: string;
    fullName: string | null;
    name: string | null;
    phone: string;
  };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return formatDateDDMMYYYY(dateStr);
}

export function getTransactionColors(tx: Transaction) {
  const isCredit = tx.type === 'CREDIT' || tx.type === 'TOP_UP';
  const status = (tx.status || '').toUpperCase();
  const purpose = (tx.purpose || '').toUpperCase();

  let badgeColor = 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
  let amountColor = 'text-amber-600 dark:text-amber-400';
  let statusBadgeColor = 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';

  if (status === 'REJECTED' || status === 'FAILED') {
    badgeColor = 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    amountColor = 'text-rose-600 dark:text-rose-400';
    statusBadgeColor = 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
  } else if (status === 'APPROVED' || status === 'SUCCESS') {
    if (purpose.includes('REWARD')) {
      badgeColor = 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
      amountColor = 'text-orange-600 dark:text-orange-400';
    } else if (purpose.includes('REFUND')) {
      badgeColor = 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
      amountColor = 'text-blue-600 dark:text-blue-400';
    } else {
      badgeColor = 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
      amountColor = 'text-emerald-600 dark:text-emerald-400';
    }
    statusBadgeColor =
      'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
  }

  if (!isCredit) {
    amountColor = 'text-rose-600 dark:text-rose-400';
  }

  return { badgeColor, amountColor, statusBadgeColor, isCredit };
}
