/**
 * R3.7h split — Earnings types & formatters.
 *
 * Earning + Summary shapes were inlined in EarningsManagement.tsx.
 * Extracted so the data hook, summary cards, and table renderer can
 * share the same view of what an earning row looks like.
 */

export interface Earning {
  id: string;
  date: string;
  platform: string | null;
  amount: number;
  trips: number;
  distance: number | null;
  hoursOnline: number | null;
  notes: string | null;
  createdAt: string;
  rider: {
    id: string;
    riderId: string;
    fullName: string | null;
    phone: string;
  };
}

export interface Summary {
  totalAmount: number;
  totalTrips: number;
  averageAmount: number;
}

export const PLATFORMS = ['ALL', 'Zomato', 'Swiggy', 'Zepto', 'Other'];

export const EARNINGS_PAGE_SIZE = 20;

/** Indian-locale currency formatter (no decimals — these are round rupee
 * values from self-reported earnings). */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
