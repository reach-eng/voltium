export interface TransactionBreakdown {
  item: string;
  amount: number;
  id: string;
}

export interface TransactionRider {
  id: string;
  riderId: string;
  fullName: string | null;
  name: string | null;
  phone: string;
}

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
  breakdowns?: TransactionBreakdown[];
  rider?: TransactionRider;
}

export interface ConfirmActionState {
  tx: Transaction;
  action: 'approve' | 'reject';
}

export interface LastBulkAction {
  ids: string[];
  previousStates: Record<string, any>;
  action: string;
}

export interface TransactionColors {
  badgeColor: string;
  amountColor: string;
  statusBadgeColor: string;
  isCredit: boolean;
}
