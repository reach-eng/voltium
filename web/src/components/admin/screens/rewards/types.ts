/**
 * R3.7l split — Rewards types.
 *
 * Reward, Summary, and RiderListItem were inlined inside
 * RewardManagement.tsx. Extracted so the data hook, the award-points
 * form, the summary cards, and the table can all share the same
 * view of a reward row.
 */

export interface Reward {
  id: string;
  riderName: string;
  riderId: string;
  title: string;
  points: number;
  createdAt: string;
}

export interface Summary {
  totalPoints: number;
  uniqueRiders: number;
  thisMonthCount: number;
  thisMonthPoints: number;
}

export interface RiderListItem {
  id: string;
  fullName: string;
  riderId: string;
}

export const EMPTY_REWARDS_SUMMARY: Summary = {
  totalPoints: 0,
  uniqueRiders: 0,
  thisMonthCount: 0,
  thisMonthPoints: 0,
};

export const REWARDS_PAGE_SIZE = 20;
export const RIDERS_PICKER_LIMIT = 50;
