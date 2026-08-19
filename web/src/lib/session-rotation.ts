/**
 * Sliding-window grace for admin refresh-token rotation (P0-9).
 *
 * The admin refresh endpoint rotates `tokenVersion` on every successful
 * refresh so a stolen refresh token cannot be replayed forever. That
 * rotation, however, means a racing retry (two tabs, Flutter web + admin
 * panel, a client retrying a timed-out request) presents a token that is
 * exactly one version behind the current one — and would otherwise be
 * rejected as "revoked".
 *
 * This module records only the bumps WE performed and lets a token that is
 * exactly one version behind the current version through — but only within
 * a 60-second window, and only if the newer version was produced by our own
 * rotation. A logout or a role/permission change also bumps the version,
 * but it does not create a record here, so an older stolen token is still
 * rejected.
 *
 * Replay bounding: the window inherently relaxes rotation (a stolen token
 * can be replayed while the admin stays active), so each window accepts at
 * most [MAX_STALE_ACCEPTS_PER_WINDOW] stale presentations. A racing pair or
 * a short retry storm sails through; an unbounded replay does not.
 *
 * In-memory, single-process scope: fine for the auth check (a multi-process
 * deploy would simply not grant the grace — it fails closed, never open).
 * Note the project runs PM2 (multi-process), so a racing retry routed to a
 * different worker than the one that recorded the bump gets a spurious 401
 * — a UX inconsistency, never a security hole.
 */

const recentBumps = new Map<
  string,
  { oldVersion: number; newVersion: number; at: number; used: number }
>();

const SLIDING_WINDOW_MS = 60 * 1000;
const MAX_ENTRIES = 1000;
const MAX_STALE_ACCEPTS_PER_WINDOW = 5;

function prune(): void {
  if (recentBumps.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of recentBumps) {
    if (now - entry.at > SLIDING_WINDOW_MS) recentBumps.delete(key);
  }
}

/** Record a tokenVersion bump performed by the refresh flow. */
export function recordTokenBump(id: string, oldVersion: number, newVersion: number): void {
  recentBumps.set(id, { oldVersion, newVersion, at: Date.now(), used: 0 });
  prune();
}

/**
 * Accept a presented token that is exactly one version behind the current
 * version, provided we rotated that version within the sliding window.
 * Each accepted presentation consumes one slot from the window's replay
 * budget (see header).
 */
export function acceptStaleVersion(
  id: string,
  tokenVersion: number,
  currentVersion: number
): boolean {
  const entry = recentBumps.get(id);
  if (!entry) return false;
  if (entry.oldVersion !== tokenVersion || entry.newVersion !== currentVersion) return false;
  if (Date.now() - entry.at > SLIDING_WINDOW_MS) return false;
  if (entry.used >= MAX_STALE_ACCEPTS_PER_WINDOW) return false;
  entry.used += 1;
  return true;
}

/** Test-only: clear the in-memory bump log between unit tests. */
export function _resetSessionRotationForTests(): void {
  recentBumps.clear();
}
