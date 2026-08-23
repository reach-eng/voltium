/**
 * T-91 (PR-1, 2026-08-23): single-source-of-truth for NOTIFICATION_SEND
 * payload `type` values. The producer (kyc.use-cases.ts and friends) and
 * the consumer (notification-dispatch.job.ts) BOTH import the same
 * literal union so a producer/consumer spelling mismatch becomes a
 * TypeScript error at build time, not a silent "Unknown payload type —
 * acking" at runtime (see AUDIT_WORKFLOWS_2026-08-23.md §1.2).
 *
 * Adding a new event type:
 *   1. Add the literal to the union below.
 *   2. Add a matching `case` in notification-dispatch.job.ts.
 *   3. The TypeScript compiler will flag the missing case if a
 *      corresponding string is ever emitted from a use-case.
 */

export const NOTIFICATION_PAYLOAD_TYPES = [
  'KYC_APPROVED',
  'KYC_REJECTED',
  'KYC_INFO_REQUIRED',
  // T-91: the actual spelling used by kyc.use-cases.ts REQUEST_INFO
  // case (line :130-134). The dispatcher had only KYC_INFO_REQUIRED,
  // so every KYC info-request fell into the default-ack branch and
  // was silently lost. Accept both spellings to keep the call sites
  // and the dispatcher in lockstep.
  'KYC_INFO_REQUESTED',
  'WALLET_TOPUP_APPROVED',
  'WALLET_TOPUP_REJECTED',
  'SUPPORT_REPLY',
  'DEPOSIT_APPROVED',
  'DEPOSIT_REJECTED',
  'REWARD_MILESTONE',
  'SHIFT_REMINDER',
  'REFERRAL_REWARD',
  'MANDATORY_UPDATE',
  'WALLET_LOW',
] as const;

export type NotificationPayloadType = (typeof NOTIFICATION_PAYLOAD_TYPES)[number];

/**
 * Type guard for runtime validation. Returns `true` when [value] is one
 * of the known payload types. The dispatcher logs a `warn` for
 * unknown values but does NOT ack them silently anymore — see
 * notification-dispatch.job.ts default branch.
 */
export function isNotificationPayloadType(
  value: unknown
): value is NotificationPayloadType {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_PAYLOAD_TYPES as readonly string[]).includes(value)
  );
}
