import { describe, it, expect } from 'vitest';
import { canTransition, getValidNextStates, validateTransition, RiderLifecycleError } from '../../../src/server/modules/riders/rider-lifecycle.service';

describe('Rider Lifecycle State Machine (Guarantor Transitions)', () => {
  it('1. PROFILE_SUBMITTED -> GUARANTOR_SUBMITTED is allowed', () => {
    expect(canTransition('PROFILE_SUBMITTED', 'GUARANTOR_SUBMITTED')).toBe(true);
  });

  it('2. GUARANTOR_SUBMITTED -> GUARANTOR_APPROVED is allowed', () => {
    expect(canTransition('GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED')).toBe(true);
  });

  it('3. GUARANTOR_APPROVED -> PLAN_SELECTED is allowed', () => {
    expect(canTransition('GUARANTOR_APPROVED', 'PLAN_SELECTED')).toBe(true);
  });

  it('4. NEW -> GUARANTOR_SUBMITTED is blocked', () => {
    expect(canTransition('NEW', 'GUARANTOR_SUBMITTED')).toBe(false);
    expect(() => validateTransition('NEW', 'GUARANTOR_SUBMITTED')).toThrow(RiderLifecycleError);
  });

  it('5. PLAN_SELECTED -> DEPOSIT_PENDING is allowed', () => {
    expect(canTransition('PLAN_SELECTED', 'DEPOSIT_PENDING')).toBe(true);
  });

  it('6. DEPOSIT_APPROVED -> KYC_SUBMITTED is allowed', () => {
    expect(canTransition('DEPOSIT_APPROVED', 'KYC_SUBMITTED')).toBe(true);
  });

  it('7. Valid next states from GUARANTOR_SUBMITTED includes GUARANTOR_APPROVED and PLAN_SELECTED', () => {
    const nextStates = getValidNextStates('GUARANTOR_SUBMITTED');
    expect(nextStates).toContain('GUARANTOR_APPROVED');
    expect(nextStates).toContain('PLAN_SELECTED');
    expect(nextStates).toContain('SUSPENDED');
  });
});
