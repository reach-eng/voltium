'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface FaqHeaderProps {
  onAddClick: () => void;
}

/**
 * R3.7n split — FAQs tab header.
 *
 * H2 + subtitle on the left, "Add FAQ" button on the right.
 */
export function FaqHeader({ onAddClick }: FaqHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">FAQs</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage frequently asked questions</p>
      </div>
      <Button onClick={onAddClick} size="sm">
        <Plus className="h-4 w-4 mr-1" /> Add FAQ
      </Button>
    </div>
  );
}
