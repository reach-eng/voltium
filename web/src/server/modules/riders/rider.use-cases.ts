/**
 * Riders module - Use cases.
 *
 * Orchestrates rider profile management, onboarding state, and lifecycle transitions.
 * All field-level security (field allowlists), relation upserts, and state transitions
 * are handled here — routes stay thin.
 */

import type { RiderState } from './rider.types';

// ── Sub-module Imports & Re-exports ─────────────────────────────────────────

export {
  GUARANTOR_FIELD_TO_DB,
  SAFE_RIDER_FIELDS,
  SAFE_KYC_FIELDS,
  SAFE_GUARANTOR_FIELDS,
  computeUpcomingRentPrompt,
  getRiderProfile,
  rejectPlan,
  getDashboard,
  registerFcmToken,
  updateRiderProfile,
  getRiderState,
} from './rider.profile';

export {
  getRewards,
  listEarnings,
  createEarning,
} from './rider.wallet-ops';

import {
  getRiderProfile,
  rejectPlan,
  getDashboard,
  registerFcmToken,
  updateRiderProfile,
  getRiderState,
} from './rider.profile';

import {
  getRewards,
  listEarnings,
  createEarning,
} from './rider.wallet-ops';

export const riderUseCases = {
  /**
   * Gets full rider profile with all relations.
   */
  async getProfile(riderDbId: string) {
    return getRiderProfile(riderDbId);
  },

  /**
   * Reject a rider plan selection with reason.
   */
  async rejectPlan(riderDbId: string, adminId: string, reason: string) {
    return rejectPlan(riderDbId, adminId, reason);
  },

  /**
   * Get full dashboard data for a rider.
   */
  async getDashboard(riderDbId: string) {
    return getDashboard(riderDbId);
  },

  /**
   * Get rewards for a rider.
   */
  async getRewards(riderDbId: string) {
    return getRewards(riderDbId);
  },

  /**
   * Register FCM token for a rider.
   */
  async registerFcmToken(riderDbId: string, fcmToken: string) {
    return registerFcmToken(riderDbId, fcmToken);
  },

  /**
   * List earnings for a rider with pagination and filters.
   */
  async listEarnings(
    riderId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      platform?: string;
      page: number;
      limit: number;
    }
  ) {
    return listEarnings(riderId, filters);
  },

  /**
   * Create an earning record for a rider.
   */
  async createEarning(
    riderId: string,
    data: {
      date: string;
      platform?: string;
      amount: number;
      trips: number;
      distance?: number;
      hoursOnline?: number;
      notes?: string;
    }
  ) {
    return createEarning(riderId, data);
  },

  /**
   * Update rider profile with field-level security.
   */
  async updateProfile(riderDbId: string, input: Record<string, unknown>) {
    return updateRiderProfile(riderDbId, input);
  },

  /**
   * Get full state snapshot for a rider.
   */
  async getState(riderDbId: string): Promise<RiderState | null> {
    return getRiderState(riderDbId);
  },
};
