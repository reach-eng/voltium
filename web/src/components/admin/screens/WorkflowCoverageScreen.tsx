'use client';

import { useState, useEffect } from 'react';
import { useAdminStore } from '@/store/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, ExternalLink, Smartphone, ShieldCheck, Loader2, AlertTriangle, XCircle } from 'lucide-react';

interface WorkflowStatus {
  id: string;
  label: string;
  status: 'green' | 'red' | 'yellow';
  detail: string;
}

interface HealthData {
  workflows: WorkflowStatus[];
  database: { status: string; detail: string };
  workers: { status: string; detail: string };
  timestamp: string;
}

const adminGroups = [
  {
    title: 'Rider onboarding and verification',
    screens: [
      ['Riders', 'riders'],
      ['Onboarding / KYC', 'kyc'],
      ['Rider Scoring', 'rider-scoring'],
    ],
  },
  {
    title: 'Rental operations',
    screens: [
      ['Rentals', 'rentals'],
      ['Vehicles', 'vehicles'],
      ['Hubs', 'hubs'],
      ['Operations', 'operations'],
      ['Fleet Map', 'fleet-map'],
      ['Shifts', 'shifts'],
      ['Team Leaders', 'team-leaders'],
    ],
  },
  {
    title: 'Money, wallet, and commercial controls',
    screens: [
      ['Finance', 'transactions'],
      ['Offers & Coupons', 'offers'],
      ['Rewards', 'rewards'],
      ['Reports & Analytics', 'analytics'],
    ],
  },
  {
    title: 'Support and communications',
    screens: [
      ['Support Tickets', 'tickets'],
      ['Incidents & Fines', 'incidents'],
      ['Messaging', 'notifications'],
      ['FAQ Management', 'faq'],
      ['Legal Documents', 'legal'],
    ],
  },
  {
    title: 'System and configuration',
    screens: [
      ['Configuration', 'business-settings'],
      ['System Settings', 'settings'],
      ['Server Health', 'server-health'],
      ['Data Management', 'data-management'],
      ['Device Tracking', 'device-tracking'],
      ['Admin Access', 'admin-users'],
    ],
  },
];

const riderGroups = [
  ['Auth', 'Splash, legal consent, permissions, login, OTP, auth choice'],
  ['KYC', 'Intent of use, rider profile, signature, documents, guarantor'],
  ['Plan and deposit', 'Choose plan, plan success, top-up purpose, amount, UPI, proof, receipt'],
  [
    'Pickup and rental',
    'Hub selection, vehicle photos, pickup verification, active dashboard, rental details, end rental',
  ],
  ['Wallet', 'Wallet, transaction history, security deposit, top-up receipt'],
  ['Support', 'Support center, checklist, FAQ, troubleshooter, feedback'],
  ['Engagement', 'Notifications, preferences, rewards, referrals'],
  [
    'Profile and safety',
    'Profile, edit profile, app settings, legal, emergency SOS, emergency contacts',
  ],
];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'green':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case 'yellow':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'red':
      return <XCircle className="h-4 w-4 text-rose-600" />;
    default:
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
}

export default function WorkflowCoverageScreen() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, []);

  // Dev-only screen: short-circuit in non-dev to avoid bundling + fetching
  // the workflow coverage data in production. Hooks above must still run
  // unconditionally to satisfy the Rules of Hooks.
  if (process.env.APP_ENV !== 'development') return null;

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/workflow-coverage');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setHealthData(json.data);
        }
      }
    } catch (err) {
      toast.error('Failed to fetch workflow health data');
    } finally {
      setLoading(false);
    }
  };

  const getWorkflowStatus = (sectionId: string): string => {
    if (!healthData) return 'unknown';
    const match = healthData.workflows.find((w) => w.id === sectionId);
    return match?.status || 'unknown';
  };

  const getWorkflowDetail = (sectionId: string): string => {
    if (!healthData) return '';
    const match = healthData.workflows.find((w) => w.id === sectionId);
    return match?.detail || '';
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-black tracking-tight">Workflow Coverage</h1>
          <Badge variant="secondary" className="ml-2">
            Admin + Rider
          </Badge>
          {healthData && (
            <span className="text-xs text-muted-foreground ml-2">
              Updated: {new Date(healthData.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          This screen is the operational map for the public beta. Every required workflow now has a
          corresponding admin console section and a rider app screen or route.
          API health checks run live against each backend endpoint.
        </p>
      </div>

      {/* System Health Bar */}
      {healthData && (
        <div className="flex flex-wrap gap-3">
          <Badge
            className={`px-3 py-1 ${
              healthData.database.status === 'green'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            variant="outline"
          >
            <StatusIcon status={healthData.database.status} />
            <span className="ml-1.5">DB: {healthData.database.status === 'green' ? 'Connected' : 'Down'}</span>
          </Badge>
          <Badge
            className={`px-3 py-1 ${
              healthData.workers.status === 'green'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : healthData.workers.status === 'yellow'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            variant="outline"
          >
            <StatusIcon status={healthData.workers.status} />
            <span className="ml-1.5">Workers: {healthData.workers.detail}</span>
          </Badge>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Admin console workflow sections
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {adminGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border p-4">
              <h3 className="font-bold">{group.title}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.screens.map(([label, section]) => {
                  const status = getWorkflowStatus(section);
                  const detail = getWorkflowDetail(section);
                  return (
                    <Button
                      key={section}
                      variant="outline"
                      className="justify-between"
                      onClick={() => setActiveSection(section)}
                    >
                      <span className="flex items-center gap-2">
                        <StatusIcon status={status} />
                        {label}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Rider app workflow screens
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {riderGroups.map(([title, description]) => (
            <div key={title} className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
