/**
 * Tests for the canonical admin UI helpers in `web/src/lib/admin-ui.ts`.
 *
 * The KYC badge color mapping is a product decision. The current state
 * (2026-07-29) is:
 *   - SUBMITTED → blue   (informational; "we received it")
 *   - PENDING   → amber  (action needed; "we're waiting")
 *   - APPROVED/VERIFIED/ACTIVE/POST_ACTIVE → emerald
 *   - REJECTED/SUSPENDED/CLOSED → rose
 *   - INFO_REQUIRED → orange
 *   - ONBOARDING/PRE_ACTIVE → amber (or slate for ONBOARDING)
 *   - unknown → slate
 *
 * If product ever changes the color for a status, update both the test
 * and the doc comment in `admin-ui.ts`.
 */

import { describe, it, expect } from 'vitest';
import { getKycBadge, getStateBadge, STATE_FILTERS } from '@/lib/admin-ui';

describe('getKycBadge — color mapping (product decision)', () => {
  it('SUBMITTED is blue (informational, not warning)', () => {
    const cls = getKycBadge('SUBMITTED');
    expect(cls).toContain('blue-500');
    expect(cls).not.toContain('amber');
  });

  it('PENDING is amber (action needed)', () => {
    const cls = getKycBadge('PENDING');
    expect(cls).toContain('amber-500');
  });

  it('APPROVED and VERIFIED are emerald', () => {
    expect(getKycBadge('APPROVED')).toContain('emerald');
    expect(getKycBadge('VERIFIED')).toContain('emerald');
  });

  it('REJECTED and SUSPENDED are rose', () => {
    expect(getKycBadge('REJECTED')).toContain('rose');
    expect(getKycBadge('SUSPENDED')).toContain('rose');
  });

  it('INFO_REQUIRED is orange', () => {
    expect(getKycBadge('INFO_REQUIRED')).toContain('orange');
  });

  it('case-insensitive', () => {
    expect(getKycBadge('submitted')).toContain('blue');
    expect(getKycBadge('SuBmItTeD')).toContain('blue');
  });

  it('unknown status falls back to slate', () => {
    expect(getKycBadge('UNKNOWN_VALUE')).toContain('slate');
  });

  it('null and undefined return slate fallback', () => {
    expect(getKycBadge(null)).toContain('slate');
    expect(getKycBadge(undefined)).toContain('slate');
    expect(getKycBadge('')).toContain('slate');
  });
});

describe('getKycBadge — cross-status consistency (regression)', () => {
  /**
   * Phase 7 follow-up: prior to consolidation, `rider-management/helpers.tsx`
   * mapped SUBMITTED to amber (grouped with PENDING) while
   * `kyc-management/*` mapped SUBMITTED to blue. This test asserts the
   * canonical blue mapping so the divergence can never reappear.
   */
  it('SUBMITTED is the same color regardless of caller (no per-file divergence)', () => {
    expect(getKycBadge('SUBMITTED')).toBe(getKycBadge('SUBMITTED'));
    expect(getKycBadge('SUBMITTED')).not.toBe(getKycBadge('PENDING'));
  });
});

describe('getStateBadge — alias for getKycBadge', () => {
  it('returns the same color as getKycBadge for the same status', () => {
    expect(getStateBadge('SUBMITTED')).toBe(getKycBadge('SUBMITTED'));
    expect(getStateBadge('ACTIVE')).toBe(getKycBadge('ACTIVE'));
    expect(getStateBadge('SUSPENDED')).toBe(getKycBadge('SUSPENDED'));
  });

  it('handles lifecycle states not in the original getKycBadge set', () => {
    expect(getStateBadge('POST_ACTIVE')).toContain('emerald');
    expect(getStateBadge('PRE_ACTIVE')).toContain('amber');
    expect(getStateBadge('KYC_SUBMITTED')).toContain('blue');
    expect(getStateBadge('ONBOARDING')).toContain('slate');
  });
});

describe('STATE_FILTERS — list shape', () => {
  it('starts with ALL (the "show everything" tab)', () => {
    expect(STATE_FILTERS[0]).toBe('ALL');
  });

  it('contains the canonical lifecycle states', () => {
    expect(STATE_FILTERS).toContain('NEW');
    expect(STATE_FILTERS).toContain('KYC_SUBMITTED');
    expect(STATE_FILTERS).toContain('ACTIVE');
    expect(STATE_FILTERS).toContain('SUSPENDED');
    expect(STATE_FILTERS).toContain('CLOSED');
  });
});
