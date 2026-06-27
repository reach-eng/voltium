'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useAdminStore } from '@/store/admin';

export default function SosAlertBanner() {
  const setActiveSection = useAdminStore((s) => s.setActiveSection);
  // #5: Dedicated API query for SOS tickets — server sends only the relevant data
  // #10: Respect auto-refresh interval from store
  const sosQuery = useQuery({
    queryKey: ['admin', 'tickets', 'sos'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tickets?category=SOS&priority=CRITICAL,HIGH&limit=1');
      if (!res.ok) throw new Error('Failed to fetch SOS tickets');
      const json = await res.json();
      return json.data as any[];
    },
    refetchInterval: 30000,
  });

  const sosTickets = sosQuery.data ?? [];
  const sosCount = sosTickets.length;

  if (sosCount === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5 shadow-lg shadow-rose-500/10 overflow-hidden ring-1 ring-rose-500/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-25" />
              <div className="relative w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/40">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
            </div>
            <div>
              <h4 className="text-xl font-bold text-rose-600 dark:text-rose-400">
                Emergency SOS Detected
              </h4>
              <p className="text-sm text-rose-500 font-medium">
                {sosCount} critical safety{' '}
                {sosCount === 1 ? 'ticket requires' : 'tickets require'} immediate action
              </p>
            </div>
          </div>
          <Button
            onClick={() => setActiveSection('tickets')}
            className="rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 px-8"
          >
            Go to SOS Hub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
