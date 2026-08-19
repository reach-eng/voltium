'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ShieldAlert, CheckCircle2, UserX } from 'lucide-react';
import Link from 'next/link';

export interface PendingDeletionItem {
  id: string;
  fullName: string;
  phone: string;
  lifecycleStatus: string;
  deletedAt: string;
  daysRemaining: number;
  /** Set once the 7-day window passed and PII was destroyed (purged). */
  purgedAt?: string;
}

export function DataDeletionQueueTable() {
  const [items, setItems] = useState<PendingDeletionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/riders?deleted=true');
      if (res.ok) {
        const data = await res.json();
        const riders = data.data?.riders || data.riders || [];
        const mapped: PendingDeletionItem[] = riders.map((r: any) => {
          const deletedDate = new Date(r.deletedAt);
          const daysPassed = (Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24);
          const daysRemaining = Math.max(0, Math.ceil(7 - daysPassed));
          return {
            id: r.id,
            fullName: r.fullName || 'Unknown Rider',
            phone: r.phone || 'N/A',
            lifecycleStatus: r.lifecycleStatus || 'CLOSED',
            deletedAt: r.deletedAt,
            daysRemaining: r.purgedAt ? 0 : daysRemaining,
            purgedAt: r.purgedAt,
          };
        });
        setItems(mapped);
      } else {
        setError('Failed to load pending deletion queue');
      }
    } catch {
      setError('Network error fetching queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/admin/riders/${id}/data-deletion/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchQueue();
      }
    } catch {
      // Ignore
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <UserX className="w-5 h-5 text-destructive" />
            Soft-Deleted Riders Queue (7-Day Grace Window)
          </CardTitle>
          <CardDescription>
            Riders pending permanent anonymization. Restoring cancels deletion.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </CardHeader>

      <CardContent className="pt-2">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading pending queue...
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40 rounded-md text-sm border">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-md">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            No riders currently pending data deletion.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium text-xs border-b">
                <tr>
                  <th className="p-3">Rider</th>
                  <th className="p-3">Soft-Deleted At</th>
                  <th className="p-3">Grace Window Remaining</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      <div>{item.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.id}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(item.deletedAt).toLocaleString()}
                      {item.purgedAt && (
                        <div className="text-xs mt-0.5">
                          Purged:{' '}
                          {new Date(item.purgedAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {item.purgedAt ? (
                        <Badge variant="outline">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-muted-foreground" />
                          Purged
                        </Badge>
                      ) : (
                        <Badge
                          variant={item.daysRemaining <= 2 ? 'destructive' : 'secondary'}
                        >
                          {item.daysRemaining}{' '}
                          {item.daysRemaining === 1 ? 'day' : 'days'} left
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link href={`/admin/riders/${item.id}/data-deletion`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Deletion Details
                        </Button>
                      </Link>
                      {!item.purgedAt && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => handleRestore(item.id)}
                          disabled={restoringId === item.id}
                        >
                          {restoringId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          )}
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
