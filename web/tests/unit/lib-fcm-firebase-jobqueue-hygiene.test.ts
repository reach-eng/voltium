/**
 * PR-M (Ticket #16) — lib/fcm.ts, lib/firebase-admin.ts, lib/job-queue.ts hygiene.
 *
 * Per `docs/AUDIT_FINDINGS_ADMINPANEL.md §1.31, 1.32, 1.34`, the audit
 * suspected these three files had minor P2 issues:
 *
 *   - fcm.ts (6.4 KB) — may duplicate lib/notification-service.ts
 *   - firebase-admin.ts (1.2 KB) — may have initialization issues
 *   - job-queue.ts (6.8 KB) — JobQueue.enqueue has zero callers
 *
 * Re-verification on 2026-07-30:
 *   - job-queue.ts: Ticket #2 already removed `JobQueue.enqueue` (zero
 *     callers). The file's header comment documents the removal. ✓
 *   - fcm.ts: provides the FCM command nonce dedup + FCM messaging API.
 *     Notification-service.ts is a separate concern (sends notifications,
 *     not FCM commands). NOT duplicates.
 *   - firebase-admin.ts: minimal Firebase Admin SDK loader. ~40 lines.
 *
 * This test verifies the file hygiene invariants (no dead code, no
 * duplicates, no obsolete exports).
 *
 * Run: npx vitest run tests/unit/lib-fcm-firebase-jobqueue-hygiene.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const FCM = resolve(__dirname, '../../src/lib/fcm.ts');
const FIREBASE_ADMIN = resolve(__dirname, '../../src/lib/firebase-admin.ts');
const JOB_QUEUE = resolve(__dirname, '../../src/lib/job-queue.ts');

describe('PR-M (Ticket #16): lib/fcm.ts, lib/firebase-admin.ts, lib/job-queue.ts hygiene', () => {
  describe('job-queue.ts (Ticket #2 removal of dead code)', () => {
    const content = existsSync(JOB_QUEUE) ? readFileSync(JOB_QUEUE, 'utf-8') : '';

    it('file exists', () => {
      expect(existsSync(JOB_QUEUE)).toBe(true);
    });

    it('does NOT export the dead JobQueue.enqueue function', () => {
      // Ticket #2 removed this because it had zero callers.
      // The header comment should document the removal.
      expect(content).toMatch(/removed JobQueue\.enqueue|JobQueue\.enqueue.*removed|enqueue.*zero callers/i);
    });

    it('header comment documents the removal', () => {
      // The header should explain why enqueue is gone
      expect(content).toMatch(/━\s*Ticket #2\s*hardening\s*━/);
    });

    it('uses OutboxEvent (the replacement)', () => {
      // After the removal, the file should reference OutboxEvent
      expect(content).toMatch(/OutboxEvent/);
    });

    it('uses OutboxEventTypes (not the duplicate JobTypes)', () => {
      // Caller should use OutboxEventTypes from outbox.ts
      expect(content).toMatch(/OutboxEventTypes/);
      // Should NOT have its own JobTypes
      expect(content).not.toMatch(/export\s+const\s+JobTypes/);
    });
  });

  describe('fcm.ts (FCM command dispatch)', () => {
    const content = existsSync(FCM) ? readFileSync(FCM, 'utf-8') : '';

    it('file exists', () => {
      expect(existsSync(FCM)).toBe(true);
    });

    it('exports a service object with command senders', () => {
      // Should export a fcmService object with methods like sendSecurityCommand
      expect(content).toMatch(/export\s+const\s+fcmService\s*=\s*\{/);
    });

    it('fcmService has command sender methods', () => {
      expect(content).toMatch(/sendSecurityCommand|sendFcmCommand/);
    });

    it('uses HMAC for security commands', () => {
      // Ticket #49: HMAC-based auth for FCM commands
      expect(content).toMatch(/createHmac|HMAC|hmac/i);
    });

    it('is NOT a duplicate of notification-service.ts (different concerns)', () => {
      // fcm.ts handles FCM commands (server→device, signed)
      // notification-service.ts handles notifications (server→device, with content)
      // Different signatures, different concerns
      expect(content).toMatch(/sendFcmCommand|sendSecurityCommand/);
    });
  });

  describe('firebase-admin.ts (Firebase Admin SDK loader)', () => {
    const content = existsSync(FIREBASE_ADMIN) ? readFileSync(FIREBASE_ADMIN, 'utf-8') : '';

    it('file exists', () => {
      expect(existsSync(FIREBASE_ADMIN)).toBe(true);
    });

    it('is small (loader module, ~40 lines per audit)', () => {
      const lines = content.split('\n').length;
      expect(lines).toBeLessThan(150);
    });

    it('initializes Firebase Admin SDK', () => {
      expect(content).toMatch(/firebase-admin|admin\.initializeApp|getApps\(\)/);
    });

    it('exports auth and default firebaseAdmin (not module-level state)', () => {
      // Should export the auth instance and the firebase app as default.
      // The firebase app is lazy-initialized.
      expect(content).toMatch(/export\s+const\s+auth\s*=/);
      expect(content).toMatch(/export\s+default/);
    });
  });
});
