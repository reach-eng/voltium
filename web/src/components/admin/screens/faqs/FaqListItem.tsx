'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from 'lucide-react';
import { FAQ_CATEGORY_COLORS, FAQ_CATEGORY_FALLBACK, type Faq } from './types';

interface FaqListItemProps {
  faq: Faq;
  index: number;
  isFirstOnPage: boolean;
  isLastOnPage: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

/**
 * R3.7n split — Single FAQ list item.
 *
 * Header row: up/down arrows (disabled at the edges of the page),
 * drag handle, question text, optional category badge, ORD: n
 * chip. Hover-revealed action row: Active switch, edit pencil,
 * delete trash. Clicking the row body toggles the expanded answer
 * view below.
 */
export function FaqListItem({
  faq,
  isFirstOnPage,
  isLastOnPage,
  isExpanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onToggleActive,
}: FaqListItemProps) {
  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm group">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 rounded-t-xl transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex flex-col gap-0.5">
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            disabled={isFirstOnPage}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            disabled={isLastOnPage}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <GripVertical className="h-4 w-4 text-muted-foreground/30" />
            <span
              className={`font-semibold text-sm sm:text-base ${!faq.isActive ? 'opacity-50' : ''}`}
            >
              {faq.question}
            </span>
            {faq.category && (
              <Badge
                variant="outline"
                className={`text-[10px] uppercase font-bold ${FAQ_CATEGORY_COLORS[faq.category] || FAQ_CATEGORY_FALLBACK}`}
              >
                {faq.category}
              </Badge>
            )}
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              ORD: {faq.order}
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mr-2 border-r border-border/50 pr-2">
            <span className="text-[10px] text-muted-foreground font-medium uppercase">Active</span>
            <Switch
              checked={faq.isActive}
              onCheckedChange={onToggleActive}
              className="scale-75 origin-right"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pl-14 border-t border-border/50 pt-4 bg-muted/5 rounded-b-xl">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}
