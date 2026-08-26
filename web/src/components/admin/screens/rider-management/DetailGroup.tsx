'use client';

import { Input } from '@/components/ui/input';

interface DetailGroupProps {
  label: string;
  value: string;
  isEditing?: boolean;
  field?: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: string[];
  onEdit?: (val: string) => void;
}

/**
 * R3.7cc split — small label/value cell used inside the rider detail
 * modal. Falls back to a "<not provided>" placeholder when the value
 * is empty.
 */
export function DetailGroup({
  label,
  value,
  isEditing,
  options,
  onEdit,
  type = 'text',
}: DetailGroupProps) {
  return (
    <div className="space-y-1.5 flex-1">
      <p className="text-[10px] items-center font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
        {label}
      </p>
      {isEditing && onEdit ? (
        type === 'select' && options ? (
          <select
            value={value}
            onChange={(e) => onEdit(e.target.value)}
            className="w-full bg-background border border-border/50 rounded-lg h-9 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o.replace('_', ' ')}
              </option>
            ))}
          </select>
        ) : (
          <Input
            type={type}
            value={value || ''}
            onChange={(e) => onEdit(e.target.value)}
            className="h-9 text-sm bg-background border-border/50 focus:border-primary/50 transition-all"
            placeholder={`Enter ${label.toLowerCase()}`}
          />
        )
      ) : (
        <p
          title={value}
          className="text-sm font-semibold text-foreground truncate min-h-[1.25rem]"
        >
          {value || (
            <span className="text-muted-foreground/30 font-normal italic">
              Not provided
            </span>
          )}
        </p>
      )}
    </div>
  );
}
