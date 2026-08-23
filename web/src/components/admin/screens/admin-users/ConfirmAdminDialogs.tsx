'use client';

/**
 * ConfirmAdminDialogs — confirmation dialogs for the two sensitive
 * admin-user actions. P0-1 (deactivate) and P1-3 (role-change) of
 * ADMIN_ADMIN_USERS_AUDIT_2026-08-24.md.
 *
 * Why a separate file:
 *   - The main AdminUserDialog is large already (Add / Edit form). Keeping
 *     the destructive-action dialogs in their own component makes the
 *     audit's fix obvious to a reviewer.
 *   - The dialogs read state from the parent (admin/role/removed perms)
 *     but call back to the parent's actions — no new useAdminUsers
 *     surface area.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Admin } from './types';

// P0-1: deactivate-confirm dialog. Requires typing the target's email
// (a unique, known-only-to-the-admin string) AND a free-text reason
// (P0-2 audit log field). Without both, the Deactivate button stays
// disabled.
export function DeactivateConfirmDialog({
  admin,
  onClose,
  onConfirm,
}: {
  admin: Admin | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [typedEmail, setTypedEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!admin) return null;
  const expected = admin.email.trim().toLowerCase();
  const typed = typedEmail.trim().toLowerCase();
  const emailOk = typed === expected;
  const reasonOk = reason.trim().length >= 3;
  const canSubmit = emailOk && reasonOk && !submitting;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!admin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Deactivate {admin.name}?
          </DialogTitle>
          <DialogDescription>
            This immediately locks <strong>{admin.name}</strong> out of the admin
            panel. They will not be able to log in until reactivated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-destructive">
              This action is recorded in the audit log with your admin id, IP, and the
              reason below. Type the admin's email to confirm.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Type <span className="font-mono">{admin.email}</span> to confirm
            </Label>
            <Input
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              placeholder={admin.email}
              className="h-10 font-mono text-xs"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for deactivation</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Role change, left the company, security incident"
              className="min-h-[80px] text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Min 3 characters. Stored in the audit log.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {submitting ? 'Deactivating...' : 'Deactivate Admin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// P1-3: role-change warning dialog. When the role change would drop
// permissions the admin currently has, show a list of what's being
// removed so the super-admin can confirm. Otherwise the change is
// applied without a confirmation (most role changes are obvious).
export function RoleChangeWarningDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: {
    admin: Admin;
    nextRole: string;
    removed: string[];
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!state) return null;
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Changing role will remove permissions
          </DialogTitle>
          <DialogDescription>
            {state.admin.name} will be moved to{' '}
            <strong>{state.nextRole}</strong> and lose the following{' '}
            {state.removed.length} permission(s):
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1 max-h-64 overflow-y-auto bg-muted/40 p-3 rounded-lg text-xs font-mono">
          {state.removed.map((p) => (
            <li key={p} className="text-destructive">
              − {p}
            </li>
          ))}
        </ul>

        <p className="text-[10px] text-muted-foreground">
          This is reversible — you can re-add the permissions after the role change.
        </p>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Remove permissions &amp; change role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// P1-1: corruption warning banner. Shown above the edit dialog when the
// stored permissions JSON was unparseable and the hook fell back to role
// defaults. Lets the super-admin know the original grants are lost.
export function CorruptionWarningBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2 text-xs mb-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-amber-700 dark:text-amber-400 font-semibold mb-0.5">
          Permissions were corrupted
        </p>
        <p className="text-amber-600/90 dark:text-amber-300/90">{message}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        className="h-7 px-2 text-amber-700"
      >
        Dismiss
      </Button>
    </div>
  );
}
