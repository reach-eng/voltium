'use client';

/**
 * P0-1 (system-settings audit, 2026-09-08): explanatory banner for cards
 * that contain frozen (formerly editable) rows. The 10 dead knobs
 * (BACKUP_FREQUENCY, BACKUP_KEEP_*, APP_PUBLIC_URL, etc.) remain in the
 * table — the operator's last value is preserved for forensic context —
 * but their Save button is gone and the runtime does not read them. This
 * banner tells the operator WHERE the knob actually lives so the row
 * isn't mistaken for a configuration surface.
 */
export function DeadKnobBanner({ category }: { category: string }) {
  const message = DEAD_KNOB_COPY[category];
  if (!message) return null;
  return (
    <div
      role="note"
      className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <strong className="font-semibold">Heads up —</strong> {message}
    </div>
  );
}

const DEAD_KNOB_COPY: Record<string, string> = {
  BACKUP:
    'scheduling, retention, and the low-disk guard are configured in ' +
    'Data Management → Schedule tab. The BACKUP_* rows shown here are ' +
    'preserved for reference and are not read by the runtime.',
  APP_URLS:
    'runtime uses the NEXT_PUBLIC_API_BASE_URL environment variable. ' +
    'The URL rows shown here are preserved for reference and are not ' +
    'read by the runtime.',
};
