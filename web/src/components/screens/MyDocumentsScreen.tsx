'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Video,
  ShieldCheck,
  Download,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderProfile } from '@/hooks/useRiderData';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

const getDocumentCategories = (rider: any) => {
  return [
    {
      title: 'Your Documents',
      type: 'PERSONAL',
      items: [
        {
          id: 'aadhaar_front',
          label: 'Aadhaar Card (Front)',
          status: rider?.kycStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.aadhaarFront,
        },
        {
          id: 'aadhaar_back',
          label: 'Aadhaar Card (Back)',
          status: rider?.kycStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.aadhaarBack,
        },
        {
          id: 'pan',
          label: 'PAN Card',
          status: rider?.kycStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.panCard,
        },
        {
          id: 'signature',
          label: 'Digital Signature',
          status: rider?.kycStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.signature,
        },
      ].filter((item) => item.url),
    },
    {
      title: "Guarantor's Documents",
      type: 'GUARANTOR',
      items: [
        {
          id: 'g_aadhaar_front',
          label: "Guarantor's Aadhaar (Front)",
          status: rider?.guarantorStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.guarantorAadhaarFront,
        },
        {
          id: 'g_aadhaar_back',
          label: "Guarantor's Aadhaar (Back)",
          status: rider?.guarantorStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.guarantorAadhaarBack,
        },
        {
          id: 'g_pan',
          label: "Guarantor's PAN",
          status: rider?.guarantorStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.guarantorPan,
        },
        {
          id: 'g_video',
          label: "Guarantor's Verification Video",
          status: rider?.guarantorStatus || 'PENDING',
          type: 'VIDEO',
          url: rider?.guarantorVideo,
        },
        {
          id: 'g_signature',
          label: "Guarantor's Signature",
          status: rider?.guarantorStatus || 'PENDING',
          type: 'IMAGE',
          url: rider?.guarantorSignature,
        },
      ].filter((item) => item.url),
    },
  ];
};

export default function MyDocumentsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const showToast = useAppStore((s) => s.showToast);
  const { rider, loading } = useRiderProfile();

  const handleDownload = (doc: any) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
      showToast(`Opening ${doc.label}...`);
    } else {
      showToast('Document URL not available');
    }
  };

  // Point 8: Store documents locally once loaded
  useEffect(() => {
    if (rider && !loading) {
      const categories = getDocumentCategories(rider);
      const hasContent = categories.some((cat) => cat.items.length > 0);
      if (hasContent) {
        localStorage.setItem(`vf_docs_cache_${rider.id}`, JSON.stringify(categories));
      }
    }
  }, [rider, loading]);

  const documentCategories = rider ? getDocumentCategories(rider) : [];
  const hasDocuments = documentCategories.some((c) => c.items.length > 0);

  return (
    <div className="min-h-screen bg-vf-surface mesh-gradient pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => setScreen('profile')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <ArrowLeft size={18} className="text-vf-on-surface" />
        </button>
        <h1 className="text-xl font-bold text-vf-on-surface">My Documents</h1>
      </div>

      <div className="px-5 space-y-6">
        {/* Verification Status Card */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-white p-5 shadow-[0px_24px_48px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <ShieldCheck size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest leading-none">
                  Security Profile
                </p>
                <h3 className="text-sm font-bold text-vf-on-surface mt-1">Verified & Secure</h3>
              </div>
            </div>
            <div className="h-2 w-20 rounded-full bg-emerald-50 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
          <p className="text-[11px] text-vf-on-surface-variant font-medium leading-relaxed">
            Your identity and guarantor information have been verified. You can view or download
            copies of your documents below.
          </p>
        </motion.div>

        {/* Document Categories */}
        {documentCategories.map((category, catIdx) => (
          <motion.div
            key={category.type}
            custom={catIdx + 1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <div className="flex items-center gap-2 mb-4 px-1">
              <h3 className="text-[11px] font-bold text-vf-on-surface-variant uppercase tracking-wider">
                {category.title}
              </h3>
              <div className="flex-1 h-px bg-vf-outline-variant/30" />
              <span className="text-[10px] font-bold text-[#0053c1]">
                {category.items.length} FILES
              </span>
            </div>

            <div className="space-y-3">
              {category.items.map((doc: any, idx: number) => (
                <div
                  key={doc.id}
                  className="group rounded-xl bg-white p-4 shadow-[0px_24px_48px_rgba(15,23,42,0.04)] flex items-center justify-between transition-transform active:scale-[0.99] border border-transparent hover:border-[#0053c1]/20"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center ${doc.type === 'VIDEO' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-[#0053c1]'}`}
                    >
                      {doc.type === 'VIDEO' ? <Video size={18} /> : <FileText size={18} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-vf-on-surface">{doc.label}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] font-bold ${doc.status === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'} uppercase tracking-widest`}
                        >
                          {doc.status}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-vf-outline-variant" />
                        <span className="text-[10px] font-bold text-vf-on-surface-variant uppercase tracking-widest">
                          {doc.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2.5 rounded-full bg-slate-50 text-slate-400 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      {doc.type === 'VIDEO' ? <Video size={16} /> : <ExternalLink size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              {category.items.length === 0 && (
                <div className="py-8 text-center bg-white/40 rounded-xl border border-dashed border-vf-outline-variant/30">
                  <p className="text-xs text-vf-on-surface-variant italic">
                    No documents submitted yet
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Support Section */}
        <motion.div
          custom={documentCategories.length + 1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="rounded-2xl bg-[#0053c1]/5 border border-[#0053c1]/10 p-5 mt-4"
        >
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#0053c1] flex items-center justify-center shrink-0">
              <AlertCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0053c1]">Having trouble with documents?</h3>
              <p className="text-[11px] font-medium text-[#0053c1]/70 leading-relaxed mt-1">
                If you see any issues with your verified documents or need to update them, please
                raise a support ticket.
              </p>
              <button
                onClick={() => setScreen('support')}
                className="mt-4 text-[11px] font-bold text-[#0053c1] uppercase tracking-wider flex items-center gap-1.5"
              >
                Contact Support <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
