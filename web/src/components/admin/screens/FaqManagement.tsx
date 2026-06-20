'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  isActive: boolean;
}

const categoryColors: Record<string, string> = {
  general: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  pricing: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  vehicle: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  payment: 'border-primary/20 text-primary bg-primary/5',
  support: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
};

const CATEGORIES = ['general', 'pricing', 'vehicle', 'payment', 'support'];

export default function FaqManagement() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFaq, setEditFaq] = useState<Faq | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    question: '',
    answer: '',
    category: '',
    order: 0,
    isActive: true,
  });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const debouncedSearch = useDebounce(search, 500);

  const fetchFaqs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
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
      setForm({ question: '', answer: '', category: '', order: faqs.length, isActive: true });
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

  const sorted = [...faqs].sort((a, b) => a.order - b.order);
  const filtered = search
    ? sorted.filter(
        (f) =>
          f.question.toLowerCase().includes(search.toLowerCase()) ||
          (f.category || '').toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">FAQs</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage frequently asked questions</p>
        </div>
        <Button onClick={() => openDialog()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add FAQ
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 w-full max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 h-10 rounded-xl border-muted-foreground/20 text-sm"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] h-10 rounded-xl border-muted-foreground/20 text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-12 text-center text-muted-foreground">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          Loading FAQs...
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-12 text-center">
          <HelpCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {search || category !== 'all' ? 'No FAQs match your filters' : 'No FAQs yet'}
          </p>
          {(search || category !== 'all') && (
            <Button
              variant="link"
              className="mt-2 text-primary"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setPage(1);
              }}
            >
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div
              key={faq.id}
              className="bg-card rounded-xl border border-border/50 shadow-sm group"
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 rounded-t-xl transition-colors"
                onClick={() => setExpanded(expanded === faq.id ? null : faq.id)}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    disabled={idx === 0 && page === 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveUp(faq);
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    disabled={idx === faqs.length - 1 && page === pagination.totalPages}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveDown(faq);
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
                        className={`text-[10px] uppercase font-bold ${categoryColors[faq.category] || 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'}`}
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
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">
                      Active
                    </span>
                    <Switch
                      checked={faq.isActive}
                      onCheckedChange={() => toggleActive(faq)}
                      className="scale-75 origin-right"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openDialog(faq)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(faq.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {expanded === faq.id && (
                <div className="px-4 pb-4 pl-14 border-t border-border/50 pt-4 bg-muted/5 rounded-b-xl">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-card px-4 py-3 rounded-xl border border-border/50 shadow-sm mt-4">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{' '}
            <span className="font-medium">{Math.min(page * 20, pagination.total)}</span> of{' '}
            <span className="font-medium">{pagination.total}</span> FAQs
          </div>
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="h-8 px-2 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editFaq ? 'Edit' : 'Add'} FAQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="The question"
              />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                placeholder="The answer"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. general, pricing"
                />
              </div>
              <div className="space-y-2">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveFaq} disabled={!form.question || !form.answer}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFaq}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
