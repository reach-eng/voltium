'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Code, Eye, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { redactPii } from '@/lib/pii-redact';

interface AuditLog {
  id: string;
  actorId: string;
  actorType?: string;
  action: string;
  entity: string;
  entityId: string;
  details: string | null;
  createdAt: string;
}

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (searchTerm) params.set('action', searchTerm);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const rawLogs = json.data?.logs || json.data || [];
          const normalized = rawLogs.map((l: any) => ({
            id: l.id,
            actorId: l.actorId || 'SYSTEM',
            actorType: l.actorType,
            action: l.action,
            entity: l.entity,
            entityId: l.entityId || '—',
            details: typeof l.details === 'object' ? JSON.stringify(l.details) : l.details,
            createdAt: l.createdAt,
          }));
          setLogs(normalized);
          if (json.pagination) {
            setTotalPages(json.pagination.totalPages || 1);
            setTotal(json.pagination.total || 0);
          }
        }
      }
    } catch {
      // silently handle or log
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((l) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      l.action.toLowerCase().includes(term) ||
      l.actorId.toLowerCase().includes(term) ||
      l.entity.toLowerCase().includes(term) ||
      (l.entityId && l.entityId.toLowerCase().includes(term)) ||
      (l.details && l.details.toLowerCase().includes(term))
    );
  });

  const getRedactedDetails = (details: string | null) => {
    if (!details) return '—';
    try {
      const parsed = JSON.parse(details);
      const redacted = redactPii(parsed);
      return JSON.stringify(redacted);
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            Browse chronological history of sensitive administrative actions ({total} total).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              className="pl-8 h-11 text-base rounded-xl"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto animate-in fade-in duration-500">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {['Action', 'Actor', 'Entity', 'Details', 'Timestamp'].map((h) => (
                      <th key={h} className="pb-3 text-left">
                        <Skeleton className="h-4 w-16" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-16 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-3 w-32" />
                      </td>
                      <td className="py-3 text-right">
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No audit logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left font-medium text-muted-foreground">
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Actor</th>
                    <th className="pb-3">Entity</th>
                    <th className="pb-3">Details</th>
                    <th className="pb-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/50">
                      <td className="py-3 font-bold text-primary">{l.action}</td>
                      <td className="py-3">{l.actorId}</td>
                      <td className="py-3">
                        <div>{l.entity}</div>
                        <div className="text-[10px] text-muted-foreground">ID: {l.entityId}</div>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(l)}
                          className="font-mono text-[10px] max-w-xs truncate text-left hover:underline text-primary/80 hover:text-primary cursor-pointer block"
                          title="Click to view full details"
                        >
                          {getRedactedDetails(l.details)}
                        </button>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(l.createdAt).toLocaleDateString()}{' '}
                        {new Date(l.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} entries)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.action} &bull; {selectedLog?.entity} ({selectedLog?.entityId})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0 text-sm">
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg text-xs">
              <div>
                <span className="text-muted-foreground">Actor:</span>{' '}
                <span className="font-medium">{selectedLog?.actorId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Time:</span>{' '}
                <span className="font-medium">
                  {selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Payload / Details JSON
              </label>
              <pre className="p-3 bg-muted rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60">
                {(() => {
                  if (!selectedLog?.details) return 'No details provided';
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                  } catch {
                    return selectedLog.details;
                  }
                })()}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
