'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2 } from 'lucide-react';
import { SettingRow } from './SettingRow';
import type { EditableSetting } from './types';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './types';

interface EditableCategoryCardProps {
  category: string;
  settings: Array<[string, EditableSetting]>;
  editValues: Record<string, string>;
  setEditValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showSecrets: Record<string, boolean>;
  setShowSecrets: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  saving: Record<string, boolean>;
  isSuperAdmin: boolean;
  onSave: (key: string) => void;
}

/**
 * R3.7k split — One category card.
 *
 * Renders the category icon + label as the card header, then a
 * vertical stack of `SettingRow` components. The card is just a
 * pass-through; all the real state lives in the data hook.
 */
export function EditableCategoryCard({
  category,
  settings,
  editValues,
  setEditValues,
  showSecrets,
  setShowSecrets,
  saving,
  isSuperAdmin,
  onSave,
}: EditableCategoryCardProps) {
  return (
    <Card className="rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            {CATEGORY_ICONS[category] || <Settings2 className="w-4 h-4 text-primary" />}
          </div>
          <CardTitle className="text-base">{CATEGORY_LABELS[category] || category}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {settings.map(([key, setting]) => (
          <SettingRow
            key={key}
            keyName={key}
            setting={setting}
            value={editValues[key] ?? ''}
            onChange={(v) => setEditValues((prev) => ({ ...prev, [key]: v }))}
            showSecret={!!showSecrets[key]}
            onToggleSecret={() =>
              setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            saving={!!saving[key]}
            isSuperAdmin={isSuperAdmin}
            onSave={() => onSave(key)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
