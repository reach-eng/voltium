'use client';

import { useRiderSession } from '@/store/riderSession';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

interface ViewAsRiderButtonProps {
  riderId: string;
  riderName: string;
}

export default function ViewAsRiderButton({ riderId, riderName }: ViewAsRiderButtonProps) {
  const { setRiderSession } = useRiderSession();

  function handleClick() {
    setRiderSession(riderId, riderName);
    // Dispatch custom event so the page-level view switcher can pick it up
    window.dispatchEvent(
      new CustomEvent('view-as-rider', {
        detail: { riderId, riderName },
      })
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="gap-1.5">
      <Eye className="w-3.5 h-3.5" />
      View as Rider
    </Button>
  );
}
