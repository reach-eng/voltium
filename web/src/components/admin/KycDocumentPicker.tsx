'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface KycDocumentOption {
  key: string;
  label: string;
}

export const KYC_DOCUMENT_OPTIONS: readonly KycDocumentOption[] = [
  { key: 'profilePhoto', label: 'Profile Photo' },
  { key: 'riderPhoto', label: 'Rider Photo (Selfie)' },
  { key: 'riderVideo', label: 'Rider Video' },
  { key: 'signature', label: 'Rider Signature' },
  { key: 'aadhaarFront', label: 'Aadhaar Front' },
  { key: 'aadhaarBack', label: 'Aadhaar Back' },
  { key: 'panCard', label: 'PAN Card' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'accountNumber', label: 'Account Number' },
  { key: 'ifscCode', label: 'IFSC Code' },
] as const;

export const ALL_KYC_DOCUMENT_KEYS = KYC_DOCUMENT_OPTIONS.map((d) => d.key);

export interface KycDocumentPickerProps {
  selectedDocs: Set<string>;
  onChange: (docs: Set<string>) => void;
  disabled?: boolean;
}

export function KycDocumentPicker({
  selectedDocs,
  onChange,
  disabled = false,
}: KycDocumentPickerProps) {
  const toggleDoc = (key: string) => {
    const next = new Set(selectedDocs);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set(ALL_KYC_DOCUMENT_KEYS));
  };

  const clearAll = () => {
    onChange(new Set());
  };

  return (
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground">
          Editable Fields / Documents to Correct <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-primary hover:underline font-medium text-[11px]"
          >
            Select All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-muted-foreground hover:underline text-[11px]"
          >
            Clear
          </button>
          <span className="text-muted-foreground text-[11px] ml-1">
            ({selectedDocs.size} of {ALL_KYC_DOCUMENT_KEYS.length})
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border bg-muted/20 max-h-48 overflow-y-auto">
        {KYC_DOCUMENT_OPTIONS.map((doc) => {
          const isChecked = selectedDocs.has(doc.key);
          return (
            <label
              key={doc.key}
              className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-xs transition-colors select-none ${
                isChecked
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted/50 text-foreground'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => !disabled && toggleDoc(doc.key)}
                disabled={disabled}
              />
              <span className="truncate">{doc.label}</span>
            </label>
          );
        })}
      </div>
      {selectedDocs.size === 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Select at least one document or field the rider must correct.
        </p>
      )}
    </div>
  );
}
