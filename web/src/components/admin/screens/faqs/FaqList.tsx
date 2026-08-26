'use client';

import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import type { Faq } from './types';
import { FaqListItem } from './FaqListItem';

interface FaqListProps {
  loading: boolean;
  faqs: Faq[];
  search: string;
  category: string;
  page: number;
  totalPages: number;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onMoveUp: (faq: Faq) => void;
  onMoveDown: (faq: Faq) => void;
  onEdit: (faq: Faq) => void;
  onDelete: (id: string) => void;
  onToggleActive: (faq: Faq) => void;
  onClearFilters: () => void;
}

/**
 * R3.7n split — FAQ list.
 *
 * Three render states: loading (centred spinner), empty (HelpCircle
 * icon + filter-aware copy + optional "Clear all filters" button),
 * and the populated list of FaqListItem cards. The up/down arrows
 * on each card are disabled at the edges of the current page.
 */
export function FaqList({
  loading,
  faqs,
  search,
  category,
  page,
  totalPages,
  expanded,
  setExpanded,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onToggleActive,
  onClearFilters,
}: FaqListProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-12 text-center text-muted-foreground">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        Loading FAQs...
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-12 text-center">
        <HelpCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">
          {search || category !== 'all' ? 'No FAQs match your filters' : 'No FAQs yet'}
        </p>
        {(search || category !== 'all') && (
          <Button variant="link" className="mt-2 text-primary" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {faqs.map((faq, idx) => (
        <FaqListItem
          key={faq.id}
          faq={faq}
          index={idx}
          isFirstOnPage={idx === 0 && page === 1}
          isLastOnPage={idx === faqs.length - 1 && page === totalPages}
          isExpanded={expanded === faq.id}
          onToggleExpand={() => setExpanded(expanded === faq.id ? null : faq.id)}
          onMoveUp={() => onMoveUp(faq)}
          onMoveDown={() => onMoveDown(faq)}
          onEdit={() => onEdit(faq)}
          onDelete={() => onDelete(faq.id)}
          onToggleActive={() => onToggleActive(faq)}
        />
      ))}
    </div>
  );
}
