'use client';

import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { riderDisplayName, type ActiveRental } from './types';

interface ReturnReviewDialogProps {
  rental: ActiveRental | null;
  onClose: () => void;
  saving: boolean;
  onApprove: (rental: ActiveRental) => void;
}

const PHOTO_FIELDS: { label: string; url: keyof ActiveRental }[] = [
  { label: 'Front', url: 'photoFront' },
  { label: 'Back', url: 'photoBack' },
  { label: 'Left', url: 'photoLeft' },
  { label: 'Right', url: 'photoRight' },
  { label: 'Speedometer', url: 'photoSpeedometer' },
];

/**
 * R3.7y split — review vehicle return dialog with inspection photos.
 */
export function ReturnReviewDialog({
  rental,
  onClose,
  saving,
  onApprove,
}: ReturnReviewDialogProps) {
  return (
    <Dialog
      open={!!rental}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Vehicle Return</DialogTitle>
          <DialogDescription>
            Inspection photos submitted by {rental ? riderDisplayName(rental) : ''}
          </DialogDescription>
        </DialogHeader>

        {rental && (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              {PHOTO_FIELDS.map((photo) => {
                const url = rental[photo.url] as string | null | undefined;
                return (
                  <div key={photo.label} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                      {photo.label}
                    </p>
                    <div className="aspect-[4/3] rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center relative">
                      {url ? (
                        <img
                          src={url}
                          alt={photo.label}
                          className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        />
                      ) : (
                        <Camera className="w-8 h-8 text-muted-foreground/20" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={saving}
                onClick={() => onApprove(rental)}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Approve Return
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
