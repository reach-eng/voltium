'use client';

import { Button } from '@/components/ui/button';
import { ANNOUNCEMENT_PAGE_SIZE } from './types';

interface AnnouncementsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * R3.7x split — simple previous/next pagination row, hidden when only
 * one page is needed.
 */
export function AnnouncementsPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: AnnouncementsPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * ANNOUNCEMENT_PAGE_SIZE + 1}–
        {Math.min(page * ANNOUNCEMENT_PAGE_SIZE, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm font-medium px-2">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
