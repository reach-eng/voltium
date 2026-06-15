'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import {
  Loader2,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Check,
  Camera,
  Video,
  ShieldCheck,
  User,
  MapPin,
  Badge,
  Play,
  Trash2,
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { parse, format as formatDateFns } from 'date-fns';

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
  suffix,
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
  suffix?: React.ReactNode;
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
        <div className="absolute right-3 top-3 flex items-center gap-2">
          {suffix}
          {verified && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        </div>
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
  className,
}: {
  title: string;
  icon: React.ReactNode;
  uploaded: boolean;
  uploading?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative ${className || ''}`}
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

export default function GuarantorScreen() {
  const setRider = useAppStore((s) => s.setRider);
  const setScreen = useAppStore((s) => s.setScreen);
  const rider = useAppStore((s) => s.rider);
  const showToast = useAppStore((s) => s.showToast);
  const { riderId } = useRiderSession();

  /* State */
  const [name, setName] = useState(rider.guarantorName || '');
  const [relation, setRelation] = useState(rider.guarantorRelation || '');
  const [dob, setDob] = useState(rider.guarantorDob || '');
  const [phone, setPhone] = useState(rider.guarantorPhone || '');
  const [fatherName, setFatherName] = useState((rider as any).guarantorFatherName || '');
  const [motherName, setMotherName] = useState((rider as any).guarantorMotherName || '');
  const [currentAddress, setCurrentAddress] = useState((rider as any).guarantorAddress || '');

  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState(rider.guarantorAadhaarFront || '');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState(rider.guarantorAadhaarBack || '');
  const [panUrl, setPanUrl] = useState(rider.guarantorPan || '');
  const [photoUrl, setPhotoUrl] = useState(rider.guarantorLivePhoto || '');
  const [videoUrl, setVideoUrl] = useState(rider.guarantorVideo || '');
  const [signatureUrl, setSignatureUrl] = useState(rider.guarantorSignature || '');

  /* OTP State */
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* Signature Logic */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasSignatureContent, setHasSignatureContent] = useState(false);

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
        aadhaarFront: 'GUARANTOR_AADHAAR_FRONT',
        aadhaarBack: 'GUARANTOR_AADHAAR_BACK',
        pan: 'GUARANTOR_PAN',
        photo: 'KYC_PHOTO',
        video: 'GUARANTOR_VIDEO',
      }[type] || type;

    formData.append('type', apiType);

    try {
      const uploadUrl = riderId ? `/api/upload?riderId=${riderId}` : '/api/upload';
      const res = await fetch(uploadUrl, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const url = data.data?.url;
      if (!url) throw new Error('Upload failed: no URL returned');

      if (type === 'aadhaarFront') setAadhaarFrontUrl(url);
      else if (type === 'aadhaarBack') setAadhaarBackUrl(url);
      else if (type === 'pan') setPanUrl(url);
      else if (type === 'photo') setPhotoUrl(url);
      else if (type === 'video') setVideoUrl(url);

      showToast(`${type} uploaded successfully`);
    } catch (err: any) {
      showToast(err.message || 'Upload failed');
    } finally {
      setIsUploading(null);
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      showToast('Enter a valid 10-digit number');
      return;
    }
    if (phone === rider.phone) {
      showToast('Guarantor phone cannot be the same as Rider phone');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setIsOtpSent(true);
      showToast('OTP sent to guarantor');
      // Autofill first box if OTP is returned in dev
      if (data.data?.otp) {
        const otpStr = data.data.otp.toString();
        setOtpArray(otpStr.split('').slice(0, 6));
      }
    } catch (err: any) {
      showToast(err.message || 'OTP delivery failed');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpArray.join('');
    if (otp.length !== 6) {
      showToast('Enter 6-digit OTP');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');

      setIsOtpVerified(true);
      showToast('Phone verified successfully');
    } catch (err: any) {
      showToast(err.message || 'OTP verification failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const nextArr = [...otpArray];
    nextArr[index] = val;
    setOtpArray(nextArr);

    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

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
    setHasSignatureContent(true);
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
    setHasSignatureContent(false);
  }, []);

  const isCanvasBlank = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return !data.some((channel) => channel !== 0);
  };

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !relation) {
      showToast('Please enter guarantor details');
      return;
    }

    if (!isOtpVerified) {
      showToast('Please verify guarantor phone number');
      return;
    }

    setIsSubmitting(true);

    let finalSignatureUrl = signatureUrl;
    if (canvasRef.current && !isCanvasBlank(canvasRef.current)) {
      try {
        finalSignatureUrl = canvasRef.current.toDataURL();
      } catch (err) {
        console.warn('Failed to get signature from canvas', err);
        finalSignatureUrl = '';
      }
    }

    let formattedDob = dob;
    if (dob && dob.includes('-') && dob.split('-')[0].length === 4) {
      const [y, m, d] = dob.split('-');
      formattedDob = `${d}-${m}-${y}`;
    }

    try {
      const res = await fetch(`/api/rider/guarantor?riderId=${rider.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderId: rider.id,
          name,
          relation,
          phone,
          dob: formattedDob,
          fatherName,
          motherName,
          address: currentAddress,
          aadhaarFront: aadhaarFrontUrl,
          aadhaarBack: aadhaarBackUrl,
          pan: panUrl,
          photo: photoUrl,
          video: videoUrl,
          signature: hasSignatureContent ? finalSignatureUrl : '',
          kycStatus: 'SUBMITTED',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit guarantor');

      setRider({
        ...rider,
        guarantorName: name,
        guarantorRelation: relation,
        guarantorPhone: phone,
        guarantorFatherName: fatherName,
        guarantorMotherName: motherName,
        guarantorAddress: currentAddress,
        guarantorDob: formattedDob,
        guarantorAadhaarFront: aadhaarFrontUrl,
        guarantorAadhaarBack: aadhaarBackUrl,
        guarantorPan: panUrl,
        guarantorLivePhoto: photoUrl,
        guarantorVideo: videoUrl,
        guarantorSignature: hasSignatureContent ? finalSignatureUrl : '',
        guarantorStatus: 'SUBMITTED',
        kycStatus: 'SUBMITTED',
      });

      showToast('Onboarding Complete!');
      setTimeout(() => setScreen('pre_dashboard'), 800);
    } catch (err: any) {
      showToast(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    name,
    relation,
    isOtpVerified,
    dob,
    phone,
    fatherName,
    motherName,
    currentAddress,
    aadhaarFrontUrl,
    aadhaarBackUrl,
    panUrl,
    photoUrl,
    videoUrl,
    signatureUrl,
    hasSignatureContent,
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
          onClick={() => setScreen('onboarding')}
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
          2/2
        </div>
      </header>

      {/* Progress Bar & Hero Section */}
      <div className="px-4 py-4 bg-white dark:bg-slate-900">
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div className="w-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]"></div>
        </div>
        <div className="mt-6">
          <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
            One more step
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            We need a few more details to set up your fleet profile securely.
          </p>
        </div>
      </div>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* Section 1: Guarantor Personal Details */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader icon={<User className="w-4 h-4" />} title="Guarantor's Details" />

          <div className="space-y-4">
            <Field
              id="fullname"
              label="Full Name"
              placeholder="Enter guarantor full name"
              value={name}
              onChange={setName}
            />

            <div className="group">
              <label
                htmlFor="dob"
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

            <div className="group">
              <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                Relationship with Applicant
              </label>
              <div className="relative">
                <select
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none text-slate-900 dark:text-slate-100"
                >
                  <option disabled value="">
                    Select Relationship
                  </option>
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="spouse">Spouse</option>
                  <option value="other">Other</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            <Field
              id="phone"
              label="Phone Number"
              placeholder="+91 00000 00000"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                setIsOtpVerified(false);
                setIsOtpSent(false);
              }}
              type="tel"
              verified={isOtpVerified}
              suffix={
                !isOtpVerified && (
                  <button
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || phone.length !== 10}
                    className="px-3 py-1 text-xs font-bold text-primary border border-primary rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-nowrap"
                  >
                    {isSendingOtp ? 'SENDING...' : isOtpSent ? 'RESEND' : 'SEND OTP'}
                  </button>
                )
              }
            />

            {isOtpSent && !isOtpVerified && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  6-digit OTP
                </label>
                <div className="flex justify-between gap-2">
                  {otpArray.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-10 h-12 text-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary outline-none text-slate-900 dark:text-slate-100 font-bold"
                    />
                  ))}
                </div>
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || otpArray.join('').length !== 6}
                  className="w-full border-2 border-primary text-primary font-semibold py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'VERIFY OTP'}
                </button>
              </div>
            )}

            <Field
              id="father-name"
              label="Father's Name"
              placeholder="Enter father's name"
              value={fatherName}
              onChange={setFatherName}
            />

            <Field
              id="mother-name"
              label="Mother's Name"
              placeholder="Enter mother's name"
              value={motherName}
              onChange={setMotherName}
            />

            <Field
              id="address"
              label="Current Address"
              placeholder="Enter guarantor full address"
              value={currentAddress}
              onChange={setCurrentAddress}
              multiline
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
              title="Guarantor<br/>Photo"
              icon={<Camera className="w-4 h-4" />}
              uploaded={!!photoUrl}
              uploading={isUploading === 'photo'}
              onClick={() => fileInputRefs.current['photo']?.click()}
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
          <input
            type="file"
            accept="video/*"
            capture="user"
            ref={(el) => {
              fileInputRefs.current['video'] = el;
            }}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange('video', e.target.files[0])}
          />
        </section>

        {/* Section 3: Video Proof */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader
            icon={<Video className="w-4 h-4" />}
            title="Video Proof"
            description="Record a 5-second video saying your name."
            bgColor="bg-red-50 dark:bg-red-900/30"
            iconColor="text-red-600"
          />

          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col items-center justify-center gap-3 relative overflow-hidden group">
            {videoUrl ? (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-500/20">
                  <Check className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Video Recorded Successfully
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Ready for verification
                  </p>
                </div>
                <button
                  onClick={() => setVideoUrl('')}
                  className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-600 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/30 shadow-sm transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  RE-RECORD VIDEO
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => fileInputRefs.current['video']?.click()}
                  className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all active:scale-90"
                >
                  <Play className="w-6 h-6 fill-current ml-1" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Start Recording
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    or click to upload video file
                  </p>
                </div>
              </>
            )}
            {isUploading === 'video' && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white animate-pulse">
                    UPLOADING VIDEO...
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Digital Signature */}
        <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
          <SectionHeader
            icon={<Badge className="w-4 h-4" />}
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

      {/* Bottom Sticky Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 max-w-md mx-auto z-20">
        {(() => {
          const isPersonalInfoComplete = !!(
            name &&
            dob &&
            relation &&
            phone.length === 10 &&
            fatherName &&
            motherName &&
            currentAddress
          );
          const isOtpComplete = isOtpVerified;
          const isDocsComplete = !!(
            aadhaarFrontUrl &&
            aadhaarBackUrl &&
            panUrl &&
            photoUrl &&
            videoUrl
          );
          const isSignatureComplete = hasSignatureContent || !!signatureUrl;
          const isFormValid =
            isPersonalInfoComplete && isOtpComplete && isDocsComplete && isSignatureComplete;

          return (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              className={`w-full bg-primary text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg active:scale-[0.98] ${!isFormValid || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  FINISH SETUP
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
