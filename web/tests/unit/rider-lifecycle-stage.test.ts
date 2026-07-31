import { describe, it, expect } from 'vitest';

export type RiderLifecycleStage = 'NEW' | 'IN_PROGRESS' | 'ACTIVE' | 'PAUSED' | 'CLOSED';

export const STAGE_MAP: Record<string, RiderLifecycleStage> = {
  'NEW': 'NEW',
  'PHONE_VERIFIED': 'NEW',
  'PROFILE_SUBMITTED': 'IN_PROGRESS',
  'KYC_SUBMITTED': 'IN_PROGRESS',
  'KYC_APPROVED': 'IN_PROGRESS',
  'GUARANTOR_SUBMITTED': 'IN_PROGRESS',
  'GUARANTOR_APPROVED': 'IN_PROGRESS',
  'DEPOSIT_PENDING': 'IN_PROGRESS',
  'DEPOSIT_APPROVED': 'IN_PROGRESS',
  'PLAN_SELECTED': 'IN_PROGRESS',
  'PICKUP_SCHEDULED': 'IN_PROGRESS',
  'ACTIVE': 'ACTIVE',
  'SUSPENDED': 'PAUSED',
  'RETURN_PENDING': 'PAUSED',
  'CLOSED': 'CLOSED',
};

export function getRiderLifecycleStage(status: string): RiderLifecycleStage {
  return STAGE_MAP[status] || 'NEW';
}

describe('RiderLifecycleStage Mapping (PR-K.1 / Ticket #6)', () => {
  it('maps initial auth statuses to NEW stage', () => {
    expect(getRiderLifecycleStage('NEW')).toBe('NEW');
    expect(getRiderLifecycleStage('PHONE_VERIFIED')).toBe('NEW');
  });

  it('maps onboarding & KYC statuses to IN_PROGRESS stage', () => {
    expect(getRiderLifecycleStage('PROFILE_SUBMITTED')).toBe('IN_PROGRESS');
    expect(getRiderLifecycleStage('KYC_SUBMITTED')).toBe('IN_PROGRESS');
    expect(getRiderLifecycleStage('KYC_APPROVED')).toBe('IN_PROGRESS');
    expect(getRiderLifecycleStage('GUARANTOR_APPROVED')).toBe('IN_PROGRESS');
    expect(getRiderLifecycleStage('DEPOSIT_APPROVED')).toBe('IN_PROGRESS');
    expect(getRiderLifecycleStage('PICKUP_SCHEDULED')).toBe('IN_PROGRESS');
  });

  it('maps ACTIVE status to ACTIVE stage', () => {
    expect(getRiderLifecycleStage('ACTIVE')).toBe('ACTIVE');
  });

  it('maps SUSPENDED and RETURN_PENDING to PAUSED stage', () => {
    expect(getRiderLifecycleStage('SUSPENDED')).toBe('PAUSED');
    expect(getRiderLifecycleStage('RETURN_PENDING')).toBe('PAUSED');
  });

  it('maps CLOSED status to CLOSED stage', () => {
    expect(getRiderLifecycleStage('CLOSED')).toBe('CLOSED');
  });
});
