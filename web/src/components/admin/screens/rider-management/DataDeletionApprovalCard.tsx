'use client';

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DataDeletionApprovalCardProps {
  riderId: string;
  riderName?: string;
  isSoftDeleted?: boolean;
  deletedAt?: string;
  onRefresh?: () => void;
}

export function DataDeletionApprovalCard({
  riderId,
  riderName = 'Rider',
  isSoftDeleted = false,
  deletedAt,
  onRefresh,
}: DataDeletionApprovalCardProps) {
  const [loading, setLoading] = useState(false);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 1. Request Approval Token (Approver action)
  const handleApproveRequest = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/data-deletion/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.data?.approvalToken) {
        setApprovalToken(data.data.approvalToken);
        setTokenExpiresAt(data.data.expiresAt);
        setMessage({
          text: 'Approval token issued! Give this token to another admin to execute deletion (Two-Person Rule).',
          type: 'success',
        });
      } else {
        setMessage({ text: data.error || 'Failed to approve deletion request', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error issuing approval token', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 2. Execute Deletion using Approval Token (Executor action)
  const handleExecuteDeletion = async () => {
    const tokenToUse = inputToken.trim() || approvalToken;
    if (!tokenToUse) {
      setMessage({ text: 'Approval token is required for two-person execution', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/data-deletion`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalToken: tokenToUse }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: data.data?.message || 'Data deletion action executed successfully.',
          type: 'success',
        });
        setApprovalToken(null);
        setInputToken('');
        if (onRefresh) onRefresh();
      } else {
        setMessage({ text: data.error || 'Execution failed', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error executing deletion', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 3. Restore Soft-deleted Rider
  const handleRestore = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/data-deletion/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: data.data?.message || 'Rider restored successfully.',
          type: 'success',
        });
        if (onRefresh) onRefresh();
      } else {
        setMessage({ text: data.error || 'Restoration failed', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error restoring rider', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/30 shadow-sm">
      <CardHeader className="bg-destructive/5 rounded-t-lg">
        <div className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="w-5 h-5" />
          <CardTitle className="text-lg font-semibold">Data Deletion & Compliance (Two-Person Rule)</CardTitle>
        </div>
        <CardDescription>
          Manage GDPR/DPDP data deletion requests for <strong>{riderName}</strong> ({riderId}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {message && (
          <div
            className={`p-3 rounded-md text-sm border flex items-start gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : message.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {isSoftDeleted ? (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Rider is currently Soft-Deleted</span>
            </div>
            <p className="text-xs text-amber-700">
              Soft-deleted at: {deletedAt ? new Date(deletedAt).toLocaleString() : 'N/A'}. Permanent anonymization will automatically occur in 7 days unless restored.
            </p>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={handleRestore} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-1" /> Restore Rider
              </Button>
              <Button size="sm" variant="destructive" onClick={handleExecuteDeletion} disabled={loading}>
                <ShieldAlert className="w-4 h-4 mr-1" /> Anonymize Immediately
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Issue Token */}
            <div className="p-3 border rounded-md space-y-2 bg-muted/20">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-primary" /> Step 1: Issue Approval Token (Person A)
              </div>
              <p className="text-xs text-muted-foreground">
                Requires `riders_delete_approve` permission. Generates a 1-hour valid token.
              </p>
              <Button size="sm" variant="secondary" onClick={handleApproveRequest} disabled={loading}>
                Issue Approval Token
              </Button>

              {approvalToken && (
                <div className="p-2 bg-background border rounded text-xs space-y-1 font-mono break-all mt-2">
                  <div className="text-muted-foreground font-sans text-[11px]">Issued Token:</div>
                  <div className="text-primary font-bold">{approvalToken}</div>
                  {tokenExpiresAt && (
                    <div className="text-[10px] text-muted-foreground font-sans">
                      Expires at: {new Date(tokenExpiresAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Execute */}
            <div className="p-3 border rounded-md space-y-2 bg-muted/20">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-destructive" /> Step 2: Execute Soft Deletion (Person B)
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the approval token issued by Person A. The executor MUST be a different admin.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste approval token here"
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" variant="destructive" onClick={handleExecuteDeletion} disabled={loading}>
                  Execute Deletion
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
