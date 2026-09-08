/**
 * NET-005 follow-up-23 (2026-09-08): the
 * `useRiders.startEditing` dead-code fix.
 *
 * The pre-fix hook exported a `startEditing`
 * function that did `setEditForm({ ...
 * selectedRider })` — a full spread of the
 * `Rider` object into the edit form. The dialog
 * has its own LOCAL whitelisted `startEditing`
 * (RiderDetailDialog.tsx:130) that only picks
 * the form fields it edits, so the hook's
 * `startEditing` was never wired in. But it was
 * exported, and one import away from being
 * wired in: any future refactor that passes
 * the hook's `startEditing` to the button (instead
 * of relying on the dialog's local one) would
 * silently re-introduce the masked-PII
 * writeback — the full spread includes
 * `aadhaarNumber`, `accountNumber` (which the
 * server masks to `XXXX1234`-style) and the
 * `walletBalance` computed field (which the
 * server's `update()` throws on by design,
 * returning a 500).
 *
 * This file is a source-content regression
 * lock: the dead function and its export must
 * never come back. If a future PR re-introduces
 * the full spread, the test fires.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HOOK_PATH = path.resolve(
  __dirname,
  '../../src/components/admin/screens/rider-management/useRiders.ts'
);

describe('NET-005 follow-up-23: useRiders.startEditing dead code is gone', () => {
  const source = fs.readFileSync(HOOK_PATH, 'utf8');

  it('the hook no longer defines a `startEditing` function with `{ ...selectedRider }`', () => {
    // The pre-fix code was:
    //   const startEditing = useCallback(() => {
    //     if (!selectedRider) return;
    //     setEditForm({ ...selectedRider });
    //     setIsEditing(true);
    //   }, [selectedRider]);
    // The full spread is the bug — it would
    // copy masked PII and `walletBalance` into
    // the form. The dialog has its own LOCAL
    // whitelisted `startEditing`; the hook
    // doesn't need one.
    //
    // Match the FUNCTION definition (not just
    // the spread substring) so a comment that
    // mentions the pre-fix code doesn't false-
    // positive the regression lock.
    expect(source).not.toMatch(
      /const\s+startEditing\s*=\s*useCallback[\s\S]*?setEditForm\(\{\s*\.\.\.selectedRider\s*\}\)/m
    );
  });

  it('the hook no longer exports a `startEditing` key in the return object', () => {
    // The pre-fix code was:
    //   return {
    //     ...
    //     startEditing,
    //     ...
    //   };
    // A line containing the standalone
    // `startEditing,` (the comma-separated
    // export slot) is the regression marker.
    // A future refactor that re-adds the
    // function will need a matching export to
    // be callable from the dialog.
    expect(source).not.toMatch(/^\s*startEditing,\s*$/m);
  });
});
