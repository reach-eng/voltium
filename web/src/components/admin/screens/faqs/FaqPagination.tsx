'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FAQ_PAGE_SIZE } from './types';
import type { FaqPagination as Pagination } from './useFaqs';

interface FaqPaginationProps {
  page: number;
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

/**
 * R3.7n split — FAQ pagination bar.
 *
 * Renders a small "Showing X to Y of Z FAQs" label on the left and
 * Previous / Next buttons on the right. Only appears when there's
 * more than one page.
 */
export function FaqPagination({ page, pagination, onPageChange }: FaqPaginationProps) {
  if (pagination.totalPages <= 1) return null;

  const start = (page - 1) * FAQ_PAGE_SIZE + 1;
  const end = Math.min(page * FAQ_PAGE_SIZE, pagination.total);

  return (
    <div className="flex items-center justify-between bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm mt-4">
      <div className="text-sm text-muted-foreground hidden sm:block">
        Showing <span className="font-medium">{start}</span> to{' '}
        <span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{pagination.total}</span> FAQs
      </div>
      <div className="flex items-center gap-2 mx-auto sm:mx-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 px-2 rounded-lg"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium px-2">
          Page {page} of {pagination.totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(pagination.totalPages, page + 1))}
          disabled={page === pagination.totalPages}
          className="h-8 px-2 rounded-lg"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
