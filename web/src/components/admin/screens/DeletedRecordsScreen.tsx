'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface DeletedRecord {
  id: string;
  entityType: string;
  entityId: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
}

export default function DeletedRecordsScreen() {
  const [deleted, setDeleted] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedRecords();
  }, [filter]);

  const loadDeletedRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/deleted-records?filter=${filter}`);
      const data = await res.json();
      if (data.success) {
        setDeleted(data.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const restoreRecord = async (model: string, recordId: string) => {
    setRestoring(recordId);
    try {
      const res = await fetch(`/api/admin/${model.toLowerCase()}s/${recordId}/restore`, {
        method: 'POST',
      });

      if (res.ok) {
        setDeleted(deleted.filter((r) => r.id !== recordId));
        alert('Record restored successfully');
      } else {
        alert('Failed to restore record');
      }
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Deleted Records</h2>
        <p className="text-gray-600">View and restore soft-deleted records</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'Rider', 'Transaction', 'SupportTicket', 'Admin'].map(
          (type) => (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              onClick={() => setFilter(type)}
            >
              {type === 'all' ? 'All' : type}
            </Button>
          )
        )}
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <AlertTriangle className="inline mr-2 h-5 w-5" />
            Deleted Records ({deleted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-600">Loading...</p>
          ) : deleted.length === 0 ? (
            <p className="text-gray-600">No deleted records found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Type</th>
                    <th className="text-left py-2 px-2">ID</th>
                    <th className="text-left py-2 px-2">Deleted By</th>
                    <th className="text-left py-2 px-2">Reason</th>
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-right py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deleted.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2">
                        <Badge variant="secondary">{record.entityType}</Badge>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {record.entityId.slice(0, 8)}...
                      </td>
                      <td className="py-2 px-2">{record.deletedBy}</td>
                      <td className="py-2 px-2 text-gray-600">{record.reason}</td>
                      <td className="py-2 px-2">
                        {new Date(record.deletedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-2 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            restoreRecord(record.entityType, record.entityId)
                          }
                          disabled={restoring === record.id}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {restoring === record.id ? 'Restoring...' : 'Restore'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retention Policy Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Data Retention Policy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700">
          <ul className="list-disc list-inside space-y-1">
            <li>Soft-deleted records are retained for 90 days</li>
            <li>Audit logs are kept indefinitely for compliance</li>
            <li>Records can be restored within retention period</li>
            <li>Permanent deletion occurs automatically after retention expires</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
