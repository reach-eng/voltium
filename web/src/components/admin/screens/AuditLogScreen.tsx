'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History, Search, RefreshCw, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simulate fetching audit logs
    setTimeout(() => {
      setLogs([
        {
          id: 'a-1',
          actorId: 'admin-1',
          action: 'KYC_APPROVED',
          entity: 'Rider',
          entityId: 'rider-123',
          details: JSON.stringify({ reviewer: 'KycReviewer1' }),
          createdAt: new Date().toISOString(),
        },
        {
          id: 'a-2',
          actorId: 'admin-1',
          action: 'SYSTEM_SETTING_UPDATED',
          entity: 'SystemSetting',
          entityId: 'maintenance_mode',
          details: JSON.stringify({ value: 'true' }),
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
        {
          id: 'a-3',
          actorId: 'admin-2',
          action: 'BACKUP_CREATED',
          entity: 'BackupJob',
          entityId: 'backup-456',
          details: JSON.stringify({ sizeBytes: 1024345 }),
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.actorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            Browse chronological history of sensitive administrative actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                      <td className="py-3 font-mono text-[10px] max-w-xs truncate">{l.details}</td>
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
        </CardContent>
      </Card>
    </div>
  );
}
