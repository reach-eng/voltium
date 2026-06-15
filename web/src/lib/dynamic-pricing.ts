/**
 * Ryd Dynamic Pricing Engine
 *
 * Prices adjust based on real-time supply/demand at each hub:
 * - High availability (>80%) → 10% discount (incentivize usage)
 * - Low availability (<20%) → 10% surge (manage scarcity)
 * - Normal range → base price (no modification)
 *
 * Pricing tiers are applied progressively, not in one jump.
 */

import { db } from '@/lib/db';

export interface HubAvailability {
  hubId: string;
  hubName: string;
  totalVehicles: number;
  availableVehicles: number;
  availabilityRatio: number;
}

export interface DynamicPriceResult {
  basePrice: number;
  finalPrice: number;
  discount: number; // positive = discount, negative = surge
  discountLabel: string; // e.g. "10% Off", "10% Surge", "Base Price"
  availability: HubAvailability;
  tier: 'surge' | 'standard' | 'discount';
}

const MAX_DISCOUNT = 0.2; // 20% max discount
const MAX_SURGE = -0.2; // 20% max surge
const HIGH_AVAIL_THRESHOLD = 0.8;
const LOW_AVAIL_THRESHOLD = 0.2;
const STANDARD_DISCOUNT_RATE = 0.1; // 10%
const STANDARD_SURGE_RATE = 0.1; // 10%

/**
 * Calculate dynamic price based on hub vehicle availability.
 *
 * - ratio > 0.8  → 10% discount
 * - ratio < 0.2  → 10% surge
 * - 0.2 ≤ ratio ≤ 0.8 → base price (no change)
 *
 * Discount/surge is clamped to ±20% max.
 * Final price is rounded to the nearest integer.
 */
export function calculateDynamicPrice(
  basePrice: number,
  availability: HubAvailability
): DynamicPriceResult {
  const { availabilityRatio } = availability;

  let discount: number;
  let tier: 'surge' | 'standard' | 'discount';
  let discountLabel: string;

  if (availabilityRatio > HIGH_AVAIL_THRESHOLD) {
    // High availability (0.8+) -> 10% discount, scaling to 20% at 1.0 ratio
    const extra = Math.max(0, (availabilityRatio - 0.9) / 0.1);
    discount = STANDARD_DISCOUNT_RATE + extra * (MAX_DISCOUNT - STANDARD_DISCOUNT_RATE);
    tier = 'discount';
    discountLabel = `${Math.round(discount * 100)}% Off`;
  } else if (availabilityRatio < LOW_AVAIL_THRESHOLD) {
    // Low availability (0.2-) -> 10% surge, scaling to 20% at 0.0 ratio
    const extra = Math.max(0, (0.1 - availabilityRatio) / 0.1);
    const surgeMagnitude =
      STANDARD_SURGE_RATE + extra * (Math.abs(MAX_SURGE) - STANDARD_SURGE_RATE);
    discount = -surgeMagnitude;
    tier = 'surge';
    discountLabel = `${Math.round(surgeMagnitude * 100)}% Surge`;
  } else {
    // Normal range → base price
    discount = 0;
    tier = 'standard';
    discountLabel = 'Base Price';
  }

  // Clamp discount/surge to ±20% max
  discount = Math.max(MAX_SURGE, Math.min(MAX_DISCOUNT, discount));

  const finalPrice = Math.round(basePrice * (1 - discount));

  return {
    basePrice,
    finalPrice,
    discount,
    discountLabel,
    availability,
    tier,
  };
}

/**
 * Fetch hub availability for dynamic pricing.
 * Uses Prisma directly instead of self-referencing HTTP call.
 */
export async function getHubAvailability(hubId: string): Promise<HubAvailability> {
  const [hub, totalVehicles, availableVehicles] = await Promise.all([
    db.hub.findUnique({ where: { id: hubId }, select: { name: true } }),
    db.vehicle.count({ where: { hubId } }),
    db.vehicle.count({ where: { hubId, status: 'AVAILABLE' } }),
  ]);

  if (!hub) {
    throw new Error(`Hub not found: ${hubId}`);
  }

  const availabilityRatio = totalVehicles > 0 ? availableVehicles / totalVehicles : 0;

  return {
    hubId,
    hubName: hub.name,
    totalVehicles,
    availableVehicles,
    availabilityRatio,
  };
}
