'use client';

import dynamic from 'next/dynamic';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const AdminLayout = dynamic(() => import('@/components/admin/AdminLayout'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-dvh">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  ),
});

export default function AdminPage() {
  return (
    <ErrorBoundary>
      <AdminLayout />
    </ErrorBoundary>
  );
}
