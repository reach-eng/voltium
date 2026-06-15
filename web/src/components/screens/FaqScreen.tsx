'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { Skeleton } from '@/components/ui/skeleton';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/branding';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function FaqScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/support/faqs');
      const json = await res.json();
      if (json.success) {
        setFaqs(json.data.faqs);
      }
    } catch (err) {
      console.error('Failed to fetch FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(faqs.map((f) => f.category || 'General')))];

  const filteredFaqs = faqs.filter((f) => {
    const matchesSearch =
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || (f.category || 'General') === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContact = (type: 'call' | 'email') => {
    if (type === 'call') {
      window.open(`tel:${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`, '_self');
    } else {
      window.open(`mailto:${SUPPORT_EMAIL}`, '_self');
    }
  };

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-10">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('support')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 transition active:scale-95"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Help & FAQ</h1>
      </div>

      <div className="px-5 pt-5 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-vf-outline" />
          <input
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl bg-white/80 backdrop-blur-sm py-4 pl-12 pr-4 text-sm font-medium text-vf-on-surface placeholder:text-vf-outline outline-none shadow-sm focus:ring-2 focus:ring-[#0053c1]/20 transition"
          />
        </div>

        {/* Categories Scroller */}
        {!loading && categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeCategory === cat
                    ? 'bg-[#0053c1] text-white shadow-md'
                    : 'bg-white text-vf-on-surface-variant hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* FAQ List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => (
              <motion.div
                key={faq.id}
                layout
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md"
              >
                <button
                  onClick={() => toggleExpand(faq.id)}
                  className="flex w-full items-center justify-between p-4 text-left transition active:bg-gray-50/50"
                >
                  <span className="text-sm font-bold text-vf-on-surface pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: expandedId === faq.id ? 180 : 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                  >
                    <ChevronDown size={18} className="text-vf-outline" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {expandedId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="border-t border-gray-50 px-4 pb-4 pt-3 text-[13px] leading-relaxed text-vf-on-surface-variant">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <Search size={24} className="text-[#0053c1]" />
              </div>
              <h3 className="text-base font-bold text-vf-on-surface">No results found</h3>
              <p className="mt-1 text-sm text-vf-on-surface-variant">
                We couldn't find any match for your search.
              </p>
            </div>
          )}
        </div>

        {/* Contact Support Section */}
        <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <MessageCircle size={20} className="text-[#0053c1]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-vf-on-surface">Still need help?</h3>
              <p className="text-[11px] text-vf-on-surface-variant">
                Our team is available 24/7 for you.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleContact('call')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-green-50 py-3 text-xs font-bold text-green-700 transition hover:bg-green-100 active:scale-95"
            >
              <Phone size={14} />
              Call Support
            </button>
            <button
              onClick={() => handleContact('email')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-purple-50 py-3 text-xs font-bold text-purple-700 transition hover:bg-purple-100 active:scale-95"
            >
              <Mail size={14} />
              Email Us
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
