'use client';

import { Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface MediaPreviewProps {
  src: string | null;
  label: string;
  type?: 'image' | 'video';
  onDelete?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * R3.7cc split — image/video preview tile with optional
 * delete + select checkboxes (used for KYC bulk delete).
 */
export function MediaPreview({
  src,
  label,
  type = 'image',
  onDelete,
  selected,
  onSelect,
}: MediaPreviewProps) {
  if (!src) {
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
        </Label>
        <div className="flex items-center gap-1">
          {onSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="h-3 w-3"
            />
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              onClick={onDelete}
              title={`Delete ${label}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
      <div className="aspect-video rounded-2xl border bg-black overflow-hidden relative group shadow-sm">
        {type === 'image' ? (
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <video src={src} controls className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl h-8 text-[10px] font-bold"
            onClick={() => window.open(src, '_blank')}
          >
            View Full
          </Button>
        </div>
      </div>
    </div>
  );
}
