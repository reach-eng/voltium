import { describe, it, expect, beforeAll } from 'vitest';

// ── Dynamic Pricing Engine ──────────────────────────────────────────────

describe('calculateDynamicPrice', () => {
  // Import the function
  let calculateDynamicPrice: (...args: any[]) => any;
  let DynamicPriceResult: any;

  beforeAll(async () => {
    const mod = await import('../src/lib/dynamic-pricing');
    calculateDynamicPrice = mod.calculateDynamicPrice;
    DynamicPriceResult = mod.DynamicPriceResult;
  });

  it('returns base price when availability is in normal range (0.2–0.8)', () => {
    const result = calculateDynamicPrice(180, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 5,
      availabilityRatio: 0.5,
    });

    expect(result.tier).toBe('standard');
    expect(result.basePrice).toBe(180);
    expect(result.finalPrice).toBe(180);
    expect(result.discount).toBe(0);
    expect(result.discountLabel).toContain('Base');
  });

  it('applies 10% discount when availability > 80%', () => {
    const result = calculateDynamicPrice(180, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 9,
      availabilityRatio: 0.9,
    });

    expect(result.tier).toBe('discount');
    expect(result.finalPrice).toBe(162); // 180 * 0.9
    expect(result.discount).toBeCloseTo(0.1, 3);
    expect(result.discountLabel).toContain('Off');
  });

  it('applies exactly 10% discount at exactly 0.81 ratio (boundary)', () => {
    const result = calculateDynamicPrice(200, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 100,
      availableVehicles: 81,
      availabilityRatio: 0.81,
    });

    expect(result.tier).toBe('discount');
    expect(result.finalPrice).toBe(180); // 200 * 0.9
  });

  it('applies 10% surge when availability < 20%', () => {
    const result = calculateDynamicPrice(180, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 1,
      availabilityRatio: 0.1,
    });

    expect(result.tier).toBe('surge');
    expect(result.finalPrice).toBe(198); // 180 * 1.1
    expect(result.discount).toBeCloseTo(-0.1, 3);
    expect(result.discountLabel).toContain('Surge');
  });

  it('applies exactly 10% surge at exactly 0.19 ratio (boundary)', () => {
    const result = calculateDynamicPrice(200, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 100,
      availableVehicles: 19,
      availabilityRatio: 0.19,
    });

    expect(result.tier).toBe('surge');
    expect(result.finalPrice).toBe(220); // 200 * 1.1
  });

  it('applies boundary discount at exactly 0.8 ratio', () => {
    const result = calculateDynamicPrice(100, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 8,
      availabilityRatio: 0.8,
    });

    expect(result.tier).toBe('standard');
    expect(result.finalPrice).toBe(100);
  });

  it('applies boundary standard at exactly 0.2 ratio', () => {
    const result = calculateDynamicPrice(100, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 2,
      availabilityRatio: 0.2,
    });

    expect(result.tier).toBe('standard');
    expect(result.finalPrice).toBe(100);
  });

  it('clamps surge to 20% maximum', () => {
    const result = calculateDynamicPrice(100, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 0,
      availabilityRatio: 0.0,
    });

    expect(result.tier).toBe('surge');
    // 0 availability → discount = min(0.2, 1 - 0) = 0.2, so 100 * 1.2 = 120
    expect(result.finalPrice).toBe(120);
  });

  it('clamps discount to 20% maximum', () => {
    const result = calculateDynamicPrice(100, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 10,
      availabilityRatio: 1.0,
    });

    expect(result.tier).toBe('discount');
    // 100% → discount = min(0.2, 1.0 - 1.0) = 0.2, so 100 * 0.8 = 80
    expect(result.finalPrice).toBe(80);
  });

  it('rounds final price to integer', () => {
    const result = calculateDynamicPrice(177, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 10,
      availableVehicles: 9,
      availabilityRatio: 0.9,
    });

    expect(result.finalPrice).toBe(Math.round(177 * 0.9));
    expect(Number.isInteger(result.finalPrice)).toBe(true);
  });

  it('preserves availability data in result', () => {
    const availability = {
      hubId: 'hub-test',
      hubName: 'Delhi Central',
      totalVehicles: 25,
      availableVehicles: 20,
      availabilityRatio: 0.8,
    };

    const result = calculateDynamicPrice(250, availability);
    expect(result.availability).toEqual(availability);
  });

  it('handles 0 total vehicles (all rented out)', () => {
    const result = calculateDynamicPrice(200, {
      hubId: 'hub-1',
      hubName: 'Test Hub',
      totalVehicles: 0,
      availableVehicles: 0,
      availabilityRatio: 0,
    });

    expect(result.tier).toBe('surge');
  });
});

console.log('✅ All test files loaded. Run with: bun test');
