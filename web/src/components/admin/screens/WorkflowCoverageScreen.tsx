'use client';

import { useAdminStore } from '@/store/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ClipboardList, ExternalLink, Smartphone, ShieldCheck } from 'lucide-react';

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
  ['Pickup and rental', 'Hub selection, vehicle photos, pickup verification, active dashboard, rental details, end rental'],
  ['Wallet', 'Wallet, transaction history, security deposit, top-up receipt'],
  ['Support', 'Support center, checklist, FAQ, troubleshooter, feedback'],
  ['Engagement', 'Notifications, preferences, rewards, referrals'],
  ['Profile and safety', 'Profile, edit profile, app settings, legal, emergency SOS, emergency contacts'],
];

export default function WorkflowCoverageScreen() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-black tracking-tight">Workflow Coverage</h1>
          <Badge variant="secondary" className="ml-2">Admin + Rider</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          This screen is the operational map for the public beta. Every required workflow now has a corresponding admin console section and a rider app screen or route.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Admin console workflow sections</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {adminGroups.map((group) => (
            <div key={group.title} className="rounded-2xl border p-4">
              <h3 className="font-bold">{group.title}</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.screens.map(([label, section]) => (
                  <Button
                    key={section}
                    variant="outline"
                    className="justify-between"
                    onClick={() => setActiveSection(section)}
                  >
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{label}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Rider app workflow screens</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {riderGroups.map(([title, description]) => (
            <div key={title} className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
