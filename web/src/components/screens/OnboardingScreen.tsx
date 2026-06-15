'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import {
  Loader2,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  User,
  ShieldCheck,
  Badge,
  Landmark,
  PenTool,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { parse, format as formatDateFns } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/*  Reusable Section Header                                            */
/* ------------------------------------------------------------------ */
function SectionHeader({
  icon,
  title,
  description,
  iconColor = 'text-primary',
  bgColor = 'bg-blue-50 dark:bg-blue-900/30',
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  iconColor?: string;
  bgColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center ${iconColor} shrink-0 mt-1`}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Standard Input Field                                               */
/* ------------------------------------------------------------------ */
function Field({
  id,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  readonly = false,
  verified = false,
  multiline = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  readonly?: boolean;
  verified?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        {multiline ? (
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <input
            id={id}
            type={type}
            readOnly={readonly}
            value={value}
            onChange={(e) => {
              if (readonly) return;
              onChange(e.target.value);
            }}
            className={`w-full ${readonly ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-500' : 'bg-white dark:bg-slate-800 text-slate-900'} border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-10 placeholder:text-slate-400 dark:text-slate-100`}
            placeholder={placeholder}
          />
        )}
        {verified && <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute right-3 top-3" />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Identity Upload Card                                               */
/* ------------------------------------------------------------------ */
function IdentityCard({
  title,
  icon,
  uploaded,
  uploading,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  uploaded: boolean;
  uploading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
    >
      <div
        className={`w-8 h-8 rounded bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center mb-2 ${uploaded ? 'text-emerald-500' : 'text-slate-400'}`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : uploaded ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          icon
        )}
      </div>
      <span
        className="text-xs font-medium text-center text-slate-900 dark:text-slate-100"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {uploaded && (
        <div className="absolute top-1 right-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        </div>
      )}
    </button>
  );
}

export default function OnboardingScreen() {
  const setRider = useAppStore((s) => s.setRider);
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);
  const showToast = useAppStore((s) => s.showToast);
  const { riderId } = useRiderSession();

  /* Form State */
  const [fullName, setFullName] = useState(rider.fullName || '');
  const [fatherName, setFatherName] = useState(rider.fatherName || '');
  const [motherName, setMotherName] = useState(rider.motherName || '');
  const [dob, setDob] = useState(rider.dob || '');
  const [email, setEmail] = useState(rider.email || '');
  const [address, setAddress] = useState(rider.currentAddress || '');

  /* Bank Details State */
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [bankName, setBankName] = useState(rider.bankName || '');
  const [bankAccount, setBankAccount] = useState(rider.bankAccount || '');
  const [bankIfsc, setBankIfsc] = useState(rider.bankIfsc || '');

  /* Upload URLs */
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(rider.aadhaarFront || '');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(rider.aadhaarBack || '');
  const [panUrl, setPanUrl] = useState(rider.panCard || '');
  const [photoUrl, setPhotoUrl] = useState(rider.profilePhoto || '');
  const [signatureUrl, setSignatureUrl] = useState(rider.signature || '');

  /* Submission / Uploading state */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
        canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleFileChange = async (type: string, file: File) => {
    setIsUploading(type);
    const formData = new FormData();
    formData.append('file', file);
    const apiType =
      {
        aadhaarFront: 'KYC_AADHAAR_FRONT',
        aadhaarBack: 'KYC_AADHAAR_BACK',
        pan: 'KYC_PAN',
        photo: 'KYC_PHOTO',
      }[type] || type;

    formData.append('type', apiType);

    try {
      const uploadUrl = riderId ? `/api/upload?riderId=${riderId}` : '/api/upload';
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const url = data.data?.url;
      if (!url) throw new Error('Upload failed: no URL returned');

      if (type === 'aadhaarFront') setAadhaarFrontUrl(url);
      else if (type === 'aadhaarBack') setAadhaarBackUrl(url);
      else if (type === 'pan') setPanUrl(url);
      else if (type === 'photo') setPhotoUrl(url);

      showToast(`${type} uploaded successfully`);
    } catch (err: any) {
      showToast(err.message || 'Upload failed');
    } finally {
      setIsUploading(null);
    }
  };

  /* Signature Logic */
  const isDrawingRef = useRef(false);

  const draw = useCallback((e: any) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2F6DDE';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const startDraw = useCallback(
    (e: any) => {
      isDrawingRef.current = true;
      draw(e);
    },
    [draw]
  );

  const stopDraw = useCallback(() => {
    isDrawingRef.current = false;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  }, []);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureUrl('');
  }, []);

  const handleNext = useCallback(async () => {
    if (!fullName.trim() || !dob || !email) {
      showToast('Please fill all personal details');
      return;
    }

    setIsSubmitting(true);

    // Auto-save signature if drawn
    let finalSignatureUrl = signatureUrl;
    if (canvasRef.current) {
      try {
        const dataUrl = canvasRef.current.toDataURL();
        finalSignatureUrl = dataUrl;
      } catch (err) {
        console.warn('Failed to get signature from canvas', err);
        finalSignatureUrl = '';
      }
    }

    try {
      const rId = rider.id || useRiderSession.getState().riderId;
      if (!rId) throw new Error('Rider identity missing. Please login again.');

      let formattedDob = dob;
      if (dob && dob.includes('-') && dob.split('-')[0].length === 4) {
        const [y, m, d] = dob.split('-');
        formattedDob = `${d}-${m}-${y}`;
      }

      setRider({
        ...rider,
        fullName,
        fatherName,
        motherName,
        dob: formattedDob,
        email,
        currentAddress: address,
        aadhaarFront: aadhaarFrontUrl,
        aadhaarBack: aadhaarBackUrl,
        panCard: panUrl,
        profilePhoto: photoUrl,
        signature: finalSignatureUrl,
        bankName,
        bankAccount,
        bankIfsc,
      });

      const res = await fetch('/api/rider/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-rider-id': rId,
        },
        body: JSON.stringify({
          riderId: rId,
          fullName,
          email,
          fatherName,
          motherName,
          dob: formattedDob,
          currentAddress: address,
          profilePhoto: photoUrl,
          aadhaarFront: aadhaarFrontUrl,
          aadhaarBack: aadhaarBackUrl,
          panCard: panUrl,
          signature: finalSignatureUrl,
          bankName,
          bankAccount,
          bankIfsc,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save onboarding progress');
      }

      await new Promise((r) => setTimeout(r, 800));
      setScreen('guarantor');
    } catch (err: any) {
      showToast(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    fullName,
    dob,
    email,
    fatherName,
    motherName,
    address,
    aadhaarFrontUrl,
    aadhaarBackUrl,
    panUrl,
    photoUrl,
    signatureUrl,
    bankName,
    bankAccount,
    bankIfsc,
    rider,
    setRider,
    setScreen,
    showToast,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 antialiased pb-32">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => setScreen('intent')}
          className="p-2 -ml-2 text-slate-900 dark:text-slate-100"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center text-slate-900 dark:text-slate-100">
          Onboarding
        </h1>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          Step
          <br />
          1/2
        </div>
      </header>

      {/* Progress Bar & Hero Section */}
      <div className="px-4 py-4 bg-white dark:bg-slate-900">
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div className="w-1/2 bg-emerald-500 rounded-full"></div>
          <div className="w-1/2 bg-indigo-100 dark:bg-indigo-900 rounded-r-full"></div>
        </div>
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
            Almost there!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            We need a few more details to set up your fleet profile securely.
          </p>
        </div>
      </div>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* Section 1: Personal Details */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader icon={<User className="w-4 h-4" />} title="Personal Details" />

          <div className="space-y-4">
            <Field
              id="rider-name"
              label="Full Name"
              placeholder="Johnathan Doe"
              value={fullName}
              onChange={setFullName}
              readonly={true}
              verified={true}
            />

            <div className="group">
              <label
                htmlFor="rider-dob"
                className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300"
              >
                Date of Birth
              </label>
              <div className="relative">
                <DatePicker
                  date={
                    dob
                      ? parse(
                          dob,
                          dob.includes('-') && dob.split('-')[0].length === 4
                            ? 'yyyy-MM-dd'
                            : 'dd-MM-yyyy',
                          new Date()
                        )
                      : undefined
                  }
                  setDate={(d) => setDob(d ? formatDateFns(d, 'dd-MM-yyyy') : '')}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-slate-900 dark:text-slate-100"
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>

            <Field
              id="rider-email"
              label="Email Address"
              placeholder="john.doe@voltium.app"
              value={email}
              onChange={setEmail}
              readonly={true}
              type="email"
            />

            <Field
              id="rider-phone"
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={rider.phone || ''}
              onChange={() => {}}
              readonly={true}
              verified={true}
              type="tel"
            />

            <Field
              id="rider-father"
              label="Father's Name"
              placeholder="Legal Father's Name"
              value={fatherName}
              onChange={setFatherName}
            />

            <Field
              id="rider-mother"
              label="Mother's Name"
              placeholder="Legal Mother's Name"
              value={motherName}
              onChange={setMotherName}
            />

            <Field
              id="rider-address"
              label="Current Address"
              placeholder="Enter your full address"
              value={address}
              onChange={setAddress}
              multiline={true}
            />
          </div>
        </section>

        {/* Section 2: Identity Verification */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader
            icon={<ShieldCheck className="w-4 h-4" />}
            title="Identity Verification"
            description="Clear photos only. Max 5MB each."
            bgColor="bg-indigo-50 dark:bg-indigo-900/30"
            iconColor="text-indigo-600 dark:text-indigo-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <IdentityCard
              title="Aadhaar Card<br/>(Front)"
              icon={<Badge className="w-4 h-4" />}
              uploaded={!!aadhaarFrontUrl}
              uploading={isUploading === 'aadhaarFront'}
              onClick={() => fileInputRefs.current['aadhaarFront']?.click()}
            />
            <IdentityCard
              title="Aadhaar Card<br/>(Back)"
              icon={<Badge className="w-4 h-4" />}
              uploaded={!!aadhaarBackUrl}
              uploading={isUploading === 'aadhaarBack'}
              onClick={() => fileInputRefs.current['aadhaarBack']?.click()}
            />
            <IdentityCard
              title="PAN Card"
              icon={<Badge className="w-4 h-4" />}
              uploaded={!!panUrl}
              uploading={isUploading === 'pan'}
              onClick={() => fileInputRefs.current['pan']?.click()}
            />
            <IdentityCard
              title="Bank Details"
              icon={<Landmark className="w-4 h-4" />}
              uploaded={!!(bankAccount && bankName && bankIfsc)}
              onClick={() => setShowBankDialog(true)}
            />
          </div>

          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current['aadhaarFront'] = el;
            }}
            className="hidden"
            onChange={(e) =>
              e.target.files?.[0] && handleFileChange('aadhaarFront', e.target.files[0])
            }
          />
          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current['aadhaarBack'] = el;
            }}
            className="hidden"
            onChange={(e) =>
              e.target.files?.[0] && handleFileChange('aadhaarBack', e.target.files[0])
            }
          />
          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current['pan'] = el;
            }}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange('pan', e.target.files[0])}
          />
          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current['photo'] = el;
            }}
            className="hidden"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFileChange('photo', e.target.files[0])}
          />
        </section>

        {/* Section 3: Digital Signature */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader
            icon={<PenTool className="w-4 h-4" />}
            title="Digital Signature"
            description="Sign below to authorize documentation."
          />

          <div className="relative group">
            <div className="h-32 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 overflow-hidden relative">
              {!isDrawingRef.current && !signatureUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    Tap to draw signature
                  </span>
                </div>
              )}
              <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
            </div>
            <button
              onClick={clearCanvas}
              className="absolute top-2 right-2 text-[10px] font-bold text-primary uppercase tracking-widest bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded-md shadow-sm"
            >
              Clear
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 max-w-md mx-auto z-20">
        {(() => {
          const isPersonalInfoComplete = !!(
            fullName &&
            dob &&
            email &&
            fatherName &&
            motherName &&
            address
          );
          const isDocsComplete = !!(aadhaarFrontUrl && aadhaarBackUrl && panUrl);
          const isBankComplete = !!(bankName && bankAccount && bankIfsc);
          const isFormValid = isPersonalInfoComplete && isDocsComplete && isBankComplete;

          return (
            <button
              onClick={handleNext}
              disabled={isSubmitting || !isFormValid}
              className={`w-full bg-primary text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg active:scale-[0.98] ${!isFormValid || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  NEXT: ADD GUARANTOR
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          );
        })()}
      </div>

      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-[90vw] rounded-2xl p-6 border-none shadow-2xl bg-white dark:bg-slate-900">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary mb-4">
              <Landmark className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Bank Details
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
              Enter your bank account information for refunds and security deposits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field
              id="bank-name"
              label="Bank Name"
              placeholder="State Bank of India"
              value={bankName}
              onChange={setBankName}
            />
            <Field
              id="bank-account"
              label="Account Number"
              placeholder="30291038472"
              value={bankAccount}
              onChange={setBankAccount}
            />
            <Field
              id="bank-ifsc"
              label="IFSC Code"
              placeholder="SBIN0001234"
              value={bankIfsc}
              onChange={setBankIfsc}
            />
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                if (!bankName || !bankAccount || !bankIfsc) {
                  showToast('Please fill all bank details');
                  return;
                }
                setShowBankDialog(false);
              }}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              Save Bank Details
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
