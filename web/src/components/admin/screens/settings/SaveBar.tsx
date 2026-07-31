'use client';

import { Button } from '@/components/ui/button';
import { Save, CheckCircle2 } from 'lucide-react';

interface SaveBarProps {
  saving: boolean;
  isDirty: boolean;
  onSave: () => void;
}

/**
 * R3.7d split — Save bar for the Business Settings tab.
 *
 * The button shows three states (saving / dirty / saved) and disables
 * itself when there are no changes. Kept as its own file because it
 * shares space with the H2 + description above the cards.
 */
export function SaveBar({ saving, isDirty, onSave }: SaveBarProps) {
  const baseClass = 'h-11 px-5 rounded-xl';
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Business Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure pricing, limits, automation and contact details
        </p>
      </div>
      <Button
        onClick={onSave}
        disabled={saving || !isDirty}
        size="default"
        className={!isDirty ? `opacity-60 ${baseClass}` : baseClass}
      >
        {saving ? (
          'Saving...'
        ) : isDirty ? (
          <>
            <Save className="h-4 w-4 mr-1" /> Save Changes
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-1" /> All Saved
          </>
        )}
      </Button>
    </div>
  );
}
