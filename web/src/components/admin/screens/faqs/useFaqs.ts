import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';
import { EMPTY_FAQ_FORM, FAQ_PAGE_SIZE, type Faq, type FaqForm } from './types';

export interface FaqPagination {
  total: number;
  totalPages: number;
}

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
  const [pagination, setPagination] = useState<FaqPagination>({ total: 0, totalPages: 1 });
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
      if (!res.ok) {
        toast.error('Failed to load FAQs');
        return;
      }
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
    } catch {
      toast.error('Failed to load FAQs');
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
      setForm({ ...EMPTY_FAQ_FORM });
    }
    setDialogOpen(true);
  };

  const saveFaq = async () => {
    try {
      const payload = { ...form, category: form.category || null };
      const url = '/api/admin/faqs';
      const method = editFaq?.id ? 'PUT' : 'POST';
      const body = editFaq?.id ? { id: editFaq.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to save FAQ');
        return;
      }

      toast.success(editFaq?.id ? 'FAQ updated' : 'FAQ created');
      setDialogOpen(false);
      fetchFaqs();
    } catch {
      toast.error('Failed to save FAQ');
    }
  };

  const confirmDeleteFaq = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/faqs?id=${deleteTarget}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to delete FAQ');
        return;
      }
      toast.success('FAQ deleted');
      setDeleteTarget(null);
      fetchFaqs();
    } catch {
      toast.error('Failed to delete FAQ');
    }
  };

  const toggleActive = async (faq: Faq) => {
    try {
      const res = await fetch('/api/admin/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: faq.id, isActive: !faq.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to update FAQ status');
        return;
      }
      toast.success(`FAQ ${!faq.isActive ? 'activated' : 'deactivated'}`);
      fetchFaqs();
    } catch {
      toast.error('Failed to update FAQ status');
    }
  };

  const moveUp = async (faq: Faq) => {
    try {
      const res = await fetch('/api/admin/faqs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: faq.id, direction: 'up' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to reorder FAQ');
        return;
      }
      fetchFaqs();
    } catch {
      toast.error('Failed to reorder FAQ');
    }
  };

  const moveDown = async (faq: Faq) => {
    try {
      const res = await fetch('/api/admin/faqs/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: faq.id, direction: 'down' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || json.error || 'Failed to reorder FAQ');
        return;
      }
      fetchFaqs();
    } catch {
      toast.error('Failed to reorder FAQ');
    }
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
