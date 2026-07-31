import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (updater: (prev: number) => number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} · {total} transactions
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="default"
          className="h-10 px-4"
          disabled={page <= 1}
          onClick={() => onPageChange((p) => p - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <span className="text-sm font-medium px-2">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="default"
          className="h-10 px-4"
          disabled={page >= totalPages}
          onClick={() => onPageChange((p) => p + 1)}
        >
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
