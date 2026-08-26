/**
 * R3.7n split — FAQ types.
 *
 * Faq + FaqForm + the category color map were inlined inside
 * FaqManagement.tsx. Extracted so the data hook, list item,
 * filters bar, and form dialog can all share the same view of a FAQ.
 */

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  isActive: boolean;
}

export interface FaqForm {
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
}

export const EMPTY_FAQ_FORM: FaqForm = {
  question: '',
  answer: '',
  category: '',
  order: 0,
  isActive: true,
};

export const FAQ_CATEGORIES = ['general', 'pricing', 'vehicle', 'payment', 'support'] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

/** Map of category → Tailwind badge class. Falls back to slate. */
export const FAQ_CATEGORY_COLORS: Record<string, string> = {
  general: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  pricing: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  vehicle: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  payment: 'border-primary/20 text-primary bg-primary/5',
  support: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
};

export const FAQ_CATEGORY_FALLBACK =
  'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';

export const FAQ_PAGE_SIZE = 20;
