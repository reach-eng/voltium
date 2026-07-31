'use client';

import React, { useEffect, useState, use } from 'react';
import { DataDeletionApprovalCard } from '@/components/admin/screens/rider-management/DataDeletionApprovalCard';
import { Loader2, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DataDeletionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const riderId = resolvedParams.id;

  const [rider, setRider] = useState<{
    id: string;
    fullName?: string;
    phone?: string;
    deletedAt?: string;
    lifecycleStatus?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRider = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}`);
      if (res.ok) {
        const data = await res.json();
        setRider(data.data || data);
      }
    } catch (e) {
      console.error('Failed to fetch rider detail:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRider();
  }, [riderId]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{rider?.fullName || 'Rider Profile'}</h1>
              <p className="text-sm text-muted-foreground">
                ID: {riderId} | Phone: {rider?.phone || 'N/A'} | Status: {rider?.lifecycleStatus || 'N/A'}
              </p>
            </div>
          </div>

          <DataDeletionApprovalCard
            riderId={riderId}
            riderName={rider?.fullName}
            isSoftDeleted={Boolean(rider?.deletedAt)}
            deletedAt={rider?.deletedAt}
            onRefresh={fetchRider}
          />
        </div>
      )}
    </div>
  );
}
