'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/types/api';
import { useRiderSession } from '@/store/riderSession';

// ─── Types ───────────────────────────────────────────────────────────────

interface RiderProfile {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  name: string | null;
  email: string | null;
  kycStatus: string;
  state: string;
  walletBalance: number;
  securityDeposit: number;
  paymentStreak: number;
  returnPending: boolean;
  submissionDate: string | null;
  assignedTlId: string | null;
  assignedTlName: string | null;
  assignedTlPhone: string | null;
  assignedTlPhoto: string | null;
  profilePhoto: string | null;
  accountStatus: string;
  currentPlan?: string | null;
  planStatus?: string;
  planStartDate?: string | null;
  planEndDate?: string | null;
  currentPlanPrice?: number;

  assignedVehicle: string | null;
  pickupHub: string | null;
  teamLeader: string | null;
  emergencyContact: string | null;
  [key: string]: unknown;
}

interface TransactionItem {
  id: string;
  type: string;
  purpose: string;
  amount: number;
  status: string;
  createdAt: string;
  description?: string;
  breakdowns?: Array<{ label: string; amount: number; type: string }>;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface TicketItem {
  id: string;
  [key: string]: unknown;
}

interface PlanItem {
  id: string;
  name: string;
  type: string;
  price: number;
  durationDays: number;
  description?: string;
  isActive: boolean;
}

interface RewardsData {
  rewards: Array<{ id: string; title: string; points: number; createdAt: string }>;
  totalPoints: number;
  thisMonthPoints: number;
  currentStreak: number;
}

interface DashboardData {
  rider: RiderProfile;
  referralCode: string | null;
  unreadNotifications: number;
  todayStats: { distance: number; power: number; speed?: number; battery?: number };
  planDaysRemaining: number | null;
}

interface TransactionResponse {
  transactions: TransactionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
}

// ─── useRiderProfile ─────────────────────────────────────────────────────

export function useRiderProfile() {
  const { riderId } = useRiderSession();

  const query = useQuery({
    queryKey: ['rider', 'profile', riderId],
    queryFn: async ({ signal }): Promise<RiderProfile | null> => {
      if (!riderId) return null;
      const res = await fetch(`/api/rider/profile?riderId=${riderId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const json: ApiResponse<RiderProfile> = await res.json();
      return json.data ?? null;
    },
    enabled: !!riderId,
    staleTime: 60 * 1000,
  });

  return {
    rider: query.data ?? null,
    loading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── useTransactions ─────────────────────────────────────────────────────

export function useTransactions(page = 1, limit = 20) {
  const { riderId } = useRiderSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rider', 'transactions', riderId, page, limit],
    queryFn: async ({ signal }): Promise<TransactionResponse> => {
      if (!riderId) return { transactions: [], pagination: null };
      const res = await fetch(
        `/api/transaction/history?riderId=${riderId}&page=${page}&limit=${limit}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const json: ApiResponse<TransactionResponse> = await res.json();
      return json.data ?? { transactions: [], pagination: null };
    },
    enabled: !!riderId,
  });

  const requestTopUp = useMutation({
    mutationFn: async (data: {
      amount: number;
      purpose: string;
      method: string;
      upiRef?: string;
      proofUrl?: string;
    }) => {
      if (!riderId) throw new Error('Not authenticated');
      const controller = new AbortController();
      const res = await fetch(`/api/transaction/request?riderId=${riderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId, ...data }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to submit top-up');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider', 'transactions', riderId] });
      queryClient.invalidateQueries({ queryKey: ['rider', 'profile', riderId] });
    },
  });

  return {
    transactions: query.data?.transactions ?? [],
    loading: query.isPending,
    error: query.error,
    requestTopUp: requestTopUp.mutateAsync,
    isRequesting: requestTopUp.isPending,
    requestError: requestTopUp.error,
    refetch: query.refetch,
  };
}

// ─── useNotifications ────────────────────────────────────────────────────

export function useNotifications() {
  const { riderId } = useRiderSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rider', 'notifications', riderId],
    queryFn: async ({ signal }): Promise<NotificationItem[]> => {
      if (!riderId) return [];
      const res = await fetch(`/api/notification/list?riderId=${riderId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const json: ApiResponse<{ notifications: NotificationItem[] }> = await res.json();
      return json.data?.notifications ?? [];
    },
    enabled: !!riderId,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!riderId) return;
      const controller = new AbortController();
      const res = await fetch(`/api/notification/list?riderId=${riderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to mark notifications as read');
    },
    onSuccess: () => {
      queryClient.setQueryData<NotificationItem[]>(
        ['rider', 'notifications', riderId],
        (old) => old?.map((n) => ({ ...n, isRead: true })) ?? []
      );
    },
  });

  return {
    notifications: query.data ?? [],
    loading: query.isPending,
    error: query.error,
    markAllRead: markAllReadMutation.mutate,
    refetch: query.refetch,
  };
}

// ─── useTickets ──────────────────────────────────────────────────────────

export function useTickets() {
  const { riderId } = useRiderSession();

  const query = useQuery({
    queryKey: ['rider', 'tickets', riderId],
    queryFn: async ({ signal }): Promise<TicketItem[]> => {
      if (!riderId) return [];
      const res = await fetch(`/api/support/tickets?riderId=${riderId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const json: ApiResponse<{ tickets: TicketItem[] }> = await res.json();
      return json.data?.tickets ?? [];
    },
    enabled: !!riderId,
  });

  return {
    tickets: query.data ?? [],
    loading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── usePlans ────────────────────────────────────────────────────────────

export function usePlans() {
  const { riderId } = useRiderSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rider', 'plans', riderId],
    queryFn: async ({ signal }): Promise<PlanItem[]> => {
      const res = await fetch('/api/rider/plans', { signal });
      if (!res.ok) throw new Error('Failed to fetch plans');
      const json: ApiResponse<PlanItem[]> = await res.json();
      return json.data ?? [];
    },
  });

  const subscribeToPlan = useMutation({
    mutationFn: async (planId: string): Promise<ApiResponse> => {
      if (!riderId) throw new Error('Not authenticated');
      const controller = new AbortController();
      const res = await fetch(`/api/rider/plans?riderId=${riderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId, planId }),
        signal: controller.signal,
      });
      return res.json() as Promise<ApiResponse>;
    },
    onSuccess: (_data, _planId) => {
      queryClient.invalidateQueries({ queryKey: ['rider'] });
    },
  });

  return {
    plans: query.data ?? [],
    loading: query.isPending,
    error: query.error,
    subscribeToPlan: subscribeToPlan.mutateAsync,
    isSubscribing: subscribeToPlan.isPending,
    refetch: query.refetch,
  };
}

// ─── useRewards ──────────────────────────────────────────────────────────

export function useRewards() {
  const { riderId } = useRiderSession();

  const query = useQuery({
    queryKey: ['rider', 'rewards', riderId],
    queryFn: async ({ signal }): Promise<RewardsData | null> => {
      if (!riderId) return null;
      const res = await fetch(`/api/rider/rewards?riderId=${riderId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch rewards');
      const json: ApiResponse<RewardsData> = await res.json();
      return json.data ?? null;
    },
    enabled: !!riderId,
  });

  return {
    rewardsData: query.data ?? null,
    loading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── useDashboard ────────────────────────────────────────────────────────

export function useDashboard() {
  const { riderId } = useRiderSession();

  const query = useQuery({
    queryKey: ['rider', 'dashboard', riderId],
    queryFn: async ({ signal }): Promise<DashboardData | null> => {
      if (!riderId) return null;
      const res = await fetch(`/api/rider/dashboard?riderId=${riderId}`, { signal });
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const json: ApiResponse<DashboardData> = await res.json();
      return json.data ?? null;
    },
    enabled: !!riderId,
    staleTime: 15 * 1000,
  });

  return {
    dashboard: query.data ?? null,
    loading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── usePickupCompletion ────────────────────────────────────────────────
export function usePickupCompletion() {
  const { riderId } = useRiderSession();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: {
      vehicleId?: string;
      hubId?: string;
      teamLeader?: string;
      emergencyContact?: string;
      pickupPhotoFront?: string | null;
      pickupPhotoBack?: string | null;
      pickupPhotoLeft?: string | null;
      pickupPhotoRight?: string | null;
      pickupPhotoWithVehicle?: string | null;
    }) => {
      if (!riderId) throw new Error('Not authenticated');
      const controller = new AbortController();
      const res = await fetch(`/api/rider/sync/pickup?riderId=${riderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId, ...data }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Failed to complete pickup');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rider', 'profile', riderId] });
      queryClient.invalidateQueries({ queryKey: ['rider', 'dashboard', riderId] });
    },
  });

  return {
    completePickup: mutation.mutateAsync,
    isCompleting: mutation.isPending,
    error: mutation.error,
  };
}
