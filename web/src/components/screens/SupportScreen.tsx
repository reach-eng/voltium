'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  Mail,
  Search,
  Wrench,
  CreditCard,
  Bike,
  User,
  MessageCircle,
  ChevronRight,
  Clock,
  Mic,
  Camera,
  Ticket,
  Loader2,
  Trash2,
  Image as ImageIcon,
  MicOff,
  Headphones,
  WifiOff,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { useTickets } from '@/hooks/useRiderData';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/branding';
import { enqueueAction } from '@/lib/offline-store';
import { compressImage } from '@/lib/image-compress';
import BottomNav from './BottomNav';
import RiderSelector from './RiderSelector';
import SyncBanner from './SyncBanner';
import { Skeleton } from '@/components/ui/skeleton';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const quickActions = [
  { icon: HelpCircle, label: 'FAQ', color: 'bg-blue-50 text-[#0053c1]' },
  { icon: Phone, label: 'Call Us', color: 'bg-green-50 text-green-600' },
  { icon: Mail, label: 'Email', color: 'bg-purple-50 text-purple-600' },
];

const categoryMap: Record<string, string> = {
  'Technical Issues': 'TECHNICAL',
  'Payments & Wallet': 'PAYMENT',
  'Vehicle Issues': 'VEHICLE',
  'Account & KYC': 'GENERAL',
  'General Inquiry': 'GENERAL',
};

const statusColorMap: Record<string, string> = {
  OPEN: 'bg-rose-100 text-rose-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
};

const categoryIconMap: Record<string, typeof Wrench> = {
  TECHNICAL: Wrench,
  PAYMENT: CreditCard,
  VEHICLE: Bike,
  GENERAL: User,
  TROUBLESHOOTER: Headphones,
};

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

export default function SupportScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);
  const showToast = useAppStore((s) => s.showToast);
  const { riderId } = useRiderSession();
  const { tickets, loading: ticketsLoading, refetch: refetchTickets } = useTickets();
  const [message, setMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('GENERAL');
  const [activeTab, setActiveTab] = useState<'tickets' | 'faqs'>('tickets');
  const [isCreating, setIsCreating] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Tickets are fetched automatically by useTickets hook
    // We can manually refetch when coming back online if needed,
    // but the hook might already handle it.
  }, []);

  const filteredTickets = (tickets as any[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleQuickAction = (label: string) => {
    if (label === 'FAQ') {
      setScreen('faq');
    } else if (label === 'Call Us') {
      window.open(`tel:${SUPPORT_PHONE.replace(/[^0-9]/g, '')}`, '_self');
    } else if (label === 'Email') {
      window.open(`mailto:${SUPPORT_EMAIL}`, '_self');
    }
  };

  if (!riderId) {
    return (
      <div className="min-h-screen bg-vf-surface flex flex-col items-center justify-center p-6">
        <Headphones className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (ticketsLoading) {
    return (
      <div className="min-h-screen bg-vf-surface pb-28">
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-7 w-36" />
        </div>
        <div className="px-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 rounded-xl" />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCompressing(true);
    const newPhotos: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await compressImage(files[i], { maxSizeBytes: 200 * 1024 });
        newPhotos.push(result.dataUrl);
      } catch (err) {
        console.error('Compression failed:', err);
        showToast('Failed to process some images');
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5)); // max 5 photos
    setCompressing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsRecording(true);
      showToast('Listening... Speak clearly');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setMessage((prev) => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      showToast('Mic error: ' + event.error);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      showToast('Please describe your issue');
      return;
    }

    setSubmitting(true);

    // Auto-generate subject from category label
    const categoryLabel =
      Object.keys(categoryMap).find((key) => categoryMap[key] === selectedCategory) ||
      'Support Request';
    const finalSubject = `${categoryLabel}: ${message.slice(0, 30)}${message.length > 30 ? '...' : ''}`;

    const attachmentData = photos.length > 0 ? JSON.stringify(photos) : null;

    if (window.navigator.onLine) {
      try {
        const res = await fetch(`/api/support/tickets?riderId=${rider.id || riderId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riderId: rider.id || riderId,
            category: selectedCategory,
            subject: finalSubject,
            message: message.trim(),
            attachments: attachmentData,
            priority: 'MEDIUM',
          }),
        });

        if (res.ok) {
          showToast('Ticket submitted successfully!');
          setMessage('');
          setPhotos([]);
          refetchTickets();
        } else {
          showToast('Failed to submit ticket. Queued for later.');
          queueOffline(finalSubject, attachmentData);
        }
      } catch {
        showToast('Connection failed. Queued for later.');
        queueOffline(finalSubject, attachmentData);
      }
    } else {
      queueOffline(finalSubject, attachmentData);
    }

    setSubmitting(false);
  };

  const queueOffline = (finalSubject: string, attachments: string | null) => {
    enqueueAction(
      'CREATE_TICKET',
      {
        riderId: rider.id || riderId,
        category: selectedCategory,
        subject: finalSubject,
        message: message.trim(),
        attachments,
        priority: 'MEDIUM',
      },
      '/api/support/tickets',
      'POST'
    );
    showToast('Saved offline — will submit when connected');
    setMessage('');
    setPhotos([]);
  };

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('active_dashboard')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">Support Center</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Offline & Sync Banner */}
        <SyncBanner />

        {/* Quick Actions Grid */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-3 gap-3"
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.label)}
                className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] transition-transform active:scale-[0.97]"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}
                >
                  <Icon size={20} />
                </div>
                <span className="text-[11px] font-semibold text-vf-on-surface">{action.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Premium Raise a Ticket Card */}
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0053c1] to-[#2176ff] p-6 text-white shadow-xl shadow-blue-500/20"
        >
          {/* Decorative background circle */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Raise a Ticket</h2>
            </div>

            <div className="space-y-4">
              {/* Issue Type */}
              <div className="space-y-1.5">
                <label
                  htmlFor="issue-type-select"
                  className="text-[10px] font-black uppercase tracking-[0.1em] text-white/60 cursor-pointer"
                >
                  Issue Type
                </label>
                <div className="relative">
                  <select
                    id="issue-type-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full appearance-none rounded-2xl bg-white/15 px-4 py-3.5 text-sm font-medium text-white outline-none ring-1 ring-white/20 transition focus:ring-white/40"
                  >
                    {Object.entries(categoryMap).map(([label, value]) => (
                      <option key={label} value={value} className="text-gray-900">
                        {label}
                      </option>
                    ))}
                    <option value="BATTERY" className="text-gray-900">
                      Battery
                    </option>
                  </select>
                  <ChevronRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-white/60 pointer-events-none" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label
                  htmlFor="ticket-description-textarea"
                  className="text-[10px] font-black uppercase tracking-[0.1em] text-white/60 cursor-pointer"
                >
                  Description
                </label>
                <div className="relative">
                  <textarea
                    id="ticket-description-textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={3}
                    className={`w-full rounded-2xl bg-white/15 px-4 py-3.5 pr-12 text-sm font-medium text-white placeholder:text-white/40 outline-none ring-1 transition resize-none ${isRecording ? 'ring-red-400 bg-red-400/10' : 'ring-white/20 focus:ring-white/40'}`}
                  />
                  <button
                    onClick={toggleRecording}
                    className={`absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition active:scale-95 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Photos Previews */}
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {photos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative group h-12 w-12 rounded-lg overflow-hidden border border-white/20"
                    >
                      <img src={p} alt="preview" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Photos Button */}
              <div className="flex justify-center">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing || photos.length >= 5}
                  className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
                >
                  {compressing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  {photos.length > 0 ? `Photos (${photos.length})` : 'Add Photos'}
                </button>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
                className="w-full rounded-full bg-white py-4 text-sm font-black text-[#0053c1] shadow-lg transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? 'Raising Ticket...' : 'Raise Ticket'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Ticket History */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="pt-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-vf-on-surface uppercase tracking-wider">
              Ticket History
            </h3>
            <span className="text-[10px] font-bold text-vf-outline bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              {filteredTickets.length} Total
            </span>
          </div>
          <div className="space-y-3">
            {filteredTickets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-white/50 border border-dashed border-vf-outline/30">
                <MessageCircle className="w-10 h-10 text-vf-outline/20 mb-2" />
                <p className="text-sm text-vf-on-surface-variant font-medium">No tickets found</p>
                <p className="text-[11px] text-vf-outline mt-1">
                  Raise a new ticket above for assistance
                </p>
              </div>
            )}
            {filteredTickets.map((ticket) => {
              const TIcon = categoryIconMap[ticket.category] || User;
              return (
                <div
                  key={ticket.id}
                  className="group flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] transition-all hover:shadow-[0px_32px_64px_rgba(15,23,42,0.06)] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vf-surface-container-low transition-colors group-hover:bg-[#0053c1]/5">
                      <TIcon size={18} className="text-[#0053c1]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-bold text-vf-on-surface truncate">
                          {ticket.subject}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusColorMap[ticket.status as string] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {(ticket.status as string).replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={11} className="text-vf-outline" />
                        <span className="text-[11px] text-vf-on-surface-variant">
                          {formatDate(ticket.createdAt)}
                        </span>
                        <span className="text-[10px] text-vf-outline/40">•</span>
                        <span className="text-[10px] font-mono text-vf-outline">
                          {ticket.ticketId}
                        </span>
                      </div>
                    </div>
                  </div>
                  {ticket.message && (
                    <div className="px-1 line-clamp-2">
                      <p className="text-xs text-vf-on-surface-variant leading-relaxed">
                        {ticket.message}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
      <BottomNav activeTab="support" />
    </div>
  );
}
