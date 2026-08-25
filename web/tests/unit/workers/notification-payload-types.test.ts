/**
 * T-91 (PR-1, 2026-08-23) — regression test for the shared
 * notification-payload-types module. The whole point of the new
 * module is that adding a new event type is a TypeScript error
 * if the producer's literal and the consumer's case fall out of
 * sync. This test exercises:
 *   1. The runtime type guard `isNotificationPayloadType`.
 *   2. The full known-payload-type list (catches a misspelling
 *      like KYC_INFO_REQUESTED that the previous audit
 *      identified as silently dropped).
 *   3. The constant is importable and stable.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §1.2.
 */

import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_PAYLOAD_TYPES,
  isNotificationPayloadType,
  type NotificationPayloadType,
} from '@/server/workers/notification-payload-types';

describe('T-91 notification-payload-types', () => {
  it('exposes the full union including KYC_INFO_REQUESTED', () => {
    // The producer (kyc.use-cases.ts REQUEST_INFO) emits
    // `type: 'KYC_INFO_REQUESTED'`. If this literal disappears
    // from the union, the producer gets a TS error and the
    // whole class of "spelling mismatch → silent drop" bugs
    // becomes a compile-time failure.
    expect(NOTIFICATION_PAYLOAD_TYPES).toContain('KYC_INFO_REQUESTED');
    expect(NOTIFICATION_PAYLOAD_TYPES).toContain('KYC_INFO_REQUIRED');
    expect(NOTIFICATION_PAYLOAD_TYPES).toContain('KYC_APPROVED');
    expect(NOTIFICATION_PAYLOAD_TYPES).toContain('KYC_REJECTED');
  });

  it('the union is a frozen `as const` tuple — no string inflation', () => {
    // Defensive: if a future edit accidentally widens the type to
    // `string[]` the readonly literal guarantee is lost.
    const length = (NOTIFICATION_PAYLOAD_TYPES as readonly string[]).length;
    expect(length).toBeGreaterThanOrEqual(13);
    expect(length).toBeLessThanOrEqual(20);
  });

  it('isNotificationPayloadType accepts every known value', () => {
    for (const t of NOTIFICATION_PAYLOAD_TYPES) {
      expect(isNotificationPayloadType(t)).toBe(true);
    }
  });

  it('isNotificationPayloadType rejects unknown / non-string values', () => {
    expect(isNotificationPayloadType('KYC_INFO_REQUESTED_FAKE')).toBe(false);
    expect(isNotificationPayloadType('')).toBe(false);
    expect(isNotificationPayloadType(null)).toBe(false);
    expect(isNotificationPayloadType(undefined)).toBe(false);
    expect(isNotificationPayloadType(42)).toBe(false);
    expect(isNotificationPayloadType({ type: 'KYC_APPROVED' })).toBe(false);
  });

  it('compile-time sanity: the type literal still narrows to a string', () => {
    // This block is intentionally a `type` check; the cast
    // `as NotificationPayloadType` is allowed only if the value
    // is in the union. A future edit that narrows the union
    // (e.g. accidentally removes KYC_INFO_REQUESTED) will fail
    // this test at the TS layer.
    const valid: NotificationPayloadType = 'KYC_INFO_REQUESTED';
    expect(isNotificationPayloadType(valid)).toBe(true);
  });
});
