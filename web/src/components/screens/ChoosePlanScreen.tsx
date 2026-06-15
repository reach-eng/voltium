'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useRiderSession } from '@/store/riderSession';
import { usePlans } from '@/hooks/useRiderData';
import RiderSelector from './RiderSelector';
import { Skeleton } from '@/components/ui/skeleton';

const typeIcons: Record<string, typeof Zap> = {
  DAILY: Zap,
  WEEKLY: Sparkles,
  MONTHLY: Crown,
};

const typePeriods: Record<string, string> = {
  DAILY: '/day',
  WEEKLY: '/week',
  MONTHLY: '/month',
};

const typeFeatures: Record<string, string[]> = {
  DAILY: ['24hr access', 'Basic insurance', '1 free recharge'],
  WEEKLY: ['7-day access', 'Full insurance', '3 free recharges', 'Priority support'],
  MONTHLY: [
    '30-day access',
    'Premium insurance',
    'Unlimited recharges',
    'Dedicated support',
    'Reward multiplier 2x',
  ],
};

export default function ChoosePlanScreen() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setScreen = useAppStore((s) => s.setScreen);
  const setRider = useAppStore((s) => s.setRider);
  const showToast = useAppStore((s) => s.showToast);
  const { riderId } = useRiderSession();
  const { plans, loading, subscribeToPlan } = usePlans();

  if (!riderId) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center p-6">
        <Zap className="w-16 h-16 text-primary/30 mb-4" />
        <h2 className="text-lg font-bold text-vf-on-surface mb-2">Select a Rider</h2>
        <p className="text-sm text-vf-on-surface-variant text-center max-w-xs mb-6">
          Choose a rider profile to view the app from their perspective.
        </p>
        <RiderSelector />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
        <Skeleton className="h-8 w-56 mb-1" />
        <Skeleton className="h-4 w-72 mb-6" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl mb-4" />
        ))}
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (!selectedPlan || !riderId) return;
    setSubscribing(true);
    setError(null);

    const result = await subscribeToPlan(selectedPlan);
    if (result.success) {
      const plan = plans.find((p) => p.id === selectedPlan);
      if (plan) {
        setRider({
          currentPlan: plan.name,
          planStatus: 'ACTIVE',
          planStartDate: new Date().toISOString(),
          planEndDate: null,
          planDone: true,
        });
      }
      setSubscribed(true);
      showToast(result.message || 'Plan subscribed successfully!');
      setTimeout(() => setScreen('plan_success'), 1500);
    } else {
      setError(result.error || 'Failed to subscribe');
      showToast(result.error || 'Failed to subscribe');
    }

    setSubscribing(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-4 pt-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[1.75rem] font-black text-[#191c1e] leading-tight">
          Choose Your Plan.
        </h1>
        <p className="text-[#424653] mt-1 text-sm">
          Select the rental plan that fits your riding style
        </p>
      </motion.div>

      {/* Plan Cards */}
      <div className="mt-6 flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {plans.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No plans available</p>
          )}
          {plans.map((plan, index) => {
            const isSelected = selectedPlan === plan.id;
            const Icon = typeIcons[plan.type] || Zap;
            const period = typePeriods[plan.type] || `/${plan.durationDays}d`;
            const features = typeFeatures[plan.type] || [];
            const isPopular = plan.type === 'WEEKLY';

            return (
              <motion.div
                key={plan.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                onClick={() => {
                  setSelectedPlan(plan.id);
                  setSubscribed(false);
                  setError(null);
                }}
                className={`relative cursor-pointer rounded-xl bg-white p-5 transition-all duration-200 ${
                  isSelected
                    ? 'border-2 border-[#0053c1] bg-blue-50/60 shadow-[0px_24px_48px_rgba(15,23,42,0.08)]'
                    : 'border border-[#e0e3e5] shadow-[0px_24px_48px_rgba(15,23,42,0.04)] hover:border-[#0053c1]/30'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 right-4 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                    Popular
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${isSelected ? 'bg-[#0053c1] text-white' : 'bg-[#f2f4f6] text-[#424653]'}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#191c1e]">{plan.name}</h3>
                      <p className="text-xs text-[#424653]">
                        {plan.description || `${plan.type} plan — ${plan.durationDays} days`}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? 'border-[#0053c1] bg-[#0053c1]' : 'border-[#e0e3e5] bg-white'}`}
                  >
                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[1.75rem] font-black text-[#191c1e]">
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-[#424653]">{period}</span>
                </div>

                <ul className="mt-3 space-y-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-[#424653]">
                      <Check
                        size={14}
                        className={isSelected ? 'text-[#0053c1]' : 'text-[#16a34a]'}
                        strokeWidth={2.5}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Error message */}
      {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="mt-8"
      >
        <button
          onClick={handleSubscribe}
          disabled={!selectedPlan || subscribing || subscribed}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0053c1] to-[#2f6dde] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0053c1]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#0053c1]/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {subscribing ? (
            <Loader2 size={18} className="animate-spin" />
          ) : subscribed ? (
            <>
              <CheckCircle2 size={18} />
              Subscribed!
            </>
          ) : (
            <>
              Subscribe Now <ArrowRight size={16} />
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
