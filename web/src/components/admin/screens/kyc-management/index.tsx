'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GuarantorManagement from './GuarantorManagement';
import { KycReviewsTab } from './KycReviewsTab';

export default function KycManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Onboarding / KYC</h2>
        <p className="text-muted-foreground text-sm">
          Review and approve rider KYC documents and guarantor submissions.
        </p>
      </div>
      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="kyc" className="text-xs px-5 font-semibold">
            KYC Review
          </TabsTrigger>
          <TabsTrigger value="guarantors" className="text-xs px-5 font-semibold">
            Guarantors
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kyc">
          <KycReviewsTab />
        </TabsContent>
        <TabsContent value="guarantors">
          <GuarantorManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
