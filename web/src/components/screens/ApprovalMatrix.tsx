'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, UserPlus, Landmark, Shield, CreditCard, Truck } from 'lucide-react';

export interface ApprovalStep {
  label: string;
  done: boolean;
  icon: React.ReactNode;
}

interface ApprovalMatrixProps {
  steps: ApprovalStep[];
}

const stepContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const stepItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

export default function ApprovalMatrix({ steps }: ApprovalMatrixProps) {
  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="rounded-xl bg-card p-5 shadow-sm border border-border/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground/80">
          Approval Progress
        </h3>
        <span className="text-xs font-bold text-muted-foreground">
          {completedCount}/{steps.length} Done
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted/30">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
          className="h-full rounded-full bg-primary"
        />
      </div>

      {/* Steps */}
      <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-2.5">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            variants={stepItem}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all duration-300 ${
              step.done
                ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.02)]'
                : 'bg-muted/30 border-transparent'
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                step.done
                  ? 'bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <span className="text-xs font-bold">{i + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-bold tracking-tight transition-colors ${
                  step.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/90'
                }`}
              >
                {step.label}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                {step.done ? 'Verified' : 'Pending'}
              </p>
            </div>
            <div className="text-muted-foreground/40 scale-90">{step.icon}</div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
