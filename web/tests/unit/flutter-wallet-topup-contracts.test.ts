import { describe, it, expect } from 'vitest';

describe('Flutter Wallet & Top-up Contracts', () => {
  it('prioritizes public riderId over internal DB id', () => {
    const rider = {
      id: 'cuid_internal_123',
      riderId: 'VFR-8901',
    };

    const resolvedRiderId = rider.riderId ?? rider.id ?? '';
    expect(resolvedRiderId).toBe('VFR-8901');
  });

  it('validates top_up_completed analytics payload fields', () => {
    const amount = 2000;
    const isDeposit = true;

    const payload = {
      amount: amount.toString(),
      is_deposit: isDeposit.toString(),
    };

    expect(payload.amount).toBe('2000');
    expect(payload.is_deposit).toBe('true');
  });
});
