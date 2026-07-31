'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { EMPTY_FAQ_FORM, FAQ_PAGE_SIZE, type Faq, type FaqForm } from './types';

export interface FaqPagination {
  total: number;
  totalPages: number;
}

const EMPTY_PAGINATION: FaqPagination = { total: 0, totalPages: 1 };

/**
 * R3.7n split — FAQs data hook.
 *
 * Owns the FAQ list + form state + dialog visibility + the
 * debounced search + category filter + pagination. All four
 * mutations (save / delete / toggle-active / move-up / move-down)
 * fire-and-refetch — the local state always reflects the server.
 */
export function useFaqs() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFaq, setEditFaq] = useState<Faq | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<FaqForm>({ ...EMPTY_FAQ_FORM });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<FaqPagination>(EMPTY_PAGINATION);
  const debouncedSearch = useDebounce(search, 500);

  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: String(FAQ_PAGE_SIZE),
        search: debouncedSearch,
      });
      if (category !== 'all') params.append('category', category);

      const res = await fetch(`/api/admin/faqs?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setFaqs(json.data || []);
        if (json.pagination) {
          setPagination({
            total: json.pagination.total,
            totalPages: json.pagination.totalPages,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [page, category, debouncedSearch]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const openDialog = (faq?: Faq) => {
    if (faq) {
      setEditFaq(faq);
      setForm({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || '',
        order: faq.order,
        isActive: faq.isActive,
      });
    } else {
      setEditFaq(null);
      setForm({ ...EMPTY_FAQ_FORM, order: faqs.length });
    }
    setDialogOpen(true);
  };

  const saveFaq = async () => {
    const payload = { ...form, category: form.category || null };
    if (editFaq?.id) {
      await fetch('/api/admin/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editFaq.id, ...payload }),
      });
    } else {
      await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setDialogOpen(false);
    fetchFaqs();
  };

  const confirmDeleteFaq = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/admin/faqs?id=${deleteTarget}`, { method: 'DELETE' });
    setDeleteTarget(null);
    fetchFaqs();
  };

  const toggleActive = async (faq: Faq) => {
    await fetch('/api/admin/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: faq.id, isActive: !faq.isActive }),
    });
    fetchFaqs();
  };

  const moveUp = async (faq: Faq) => {
    if (faq.order <= 0) return;
    const sorted = [...faqs].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.id === faq.id);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    await fetch('/api/admin/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: faq.id, order: prev.order }),
    });
    await fetch('/api/admin/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prev.id, order: faq.order }),
    });
    fetchFaqs();
  };

  const moveDown = async (faq: Faq) => {
    const sorted = [...faqs].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((f) => f.id === faq.id);
    if (idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    await fetch('/api/admin/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: faq.id, order: next.order }),
    });
    await fetch('/api/admin/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: next.id, order: faq.order }),
    });
    fetchFaqs();
  };

  return {
    // data
    faqs,
    loading,
    pagination,
    // filters
    search,
    setSearch,
    category,
    setCategory,
    page,
    setPage,
    // form
    dialogOpen,
    setDialogOpen,
    editFaq,
    form,
    setForm,
    openDialog,
    saveFaq,
    // delete
    deleteTarget,
    setDeleteTarget,
    confirmDeleteFaq,
    // per-row actions
    expanded,
    setExpanded,
    toggleActive,
    moveUp,
    moveDown,
    // revalidation
    fetchFaqs,
  };
}

export type FaqsHook = ReturnType<typeof useFaqs>;
