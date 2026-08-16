'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { formatKeyLabel } from './formatKey';
import type { EditableSetting } from './types';

interface SettingRowProps {
  keyName: string;
  setting: EditableSetting;
  value: string;
  onChange: (v: string) => void;
  showSecret: boolean;
  onToggleSecret: () => void;
  saving: boolean;
  isSuperAdmin: boolean;
  onSave: () => void;
}

/**
 * R3.7k split — Single editable setting row.
 *
 * Label + optional SECRET badge on the left, optional eye toggle +
 * Save button on the right. The input renders a different type per
 * setting (password when secret is hidden, number when valueType is
 * NUMBER, otherwise text). Disabled when the setting isn't editable
 * or the current admin isn't a super admin.
 */
export function SettingRow({
  keyName,
  setting,
  value,
  onChange,
  showSecret,
  onToggleSecret,
  saving,
  isSuperAdmin,
  onSave,
}: SettingRowProps) {
  const label = formatKeyLabel(keyName);
  const inputType =
    setting.isSecret && !showSecret
      ? 'password'
      : setting.valueType === 'NUMBER'
        ? 'number'
        : 'text';
  const inputValue = setting.isSecret && !showSecret ? '[CONFIGURED]' : (value ?? '');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {setting.isSecret && (
            <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-600 dark:text-amber-400">
              SECRET
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {setting.isSecret && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 p-0"
              onClick={onToggleSecret}
            >
              {showSecret ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          )}
          <Button
            size="default"
            className="h-10 px-4 text-sm"
            onClick={onSave}
            disabled={saving || !isSuperAdmin}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>
      <div className="flex gap-3">
        <Input
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          className="text-base font-mono h-11 rounded-xl"
          placeholder={`Enter ${label.toLowerCase()}`}
          type={inputType}
          disabled={!setting.isEditable || !isSuperAdmin}
        />
      </div>
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}
    </div>
  );
}
