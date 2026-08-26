'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Save,
  FileText,
  Clock,
  Eye,
  EyeOff,
  Shield,
  DollarSign,
  FileSignature,
  AlertTriangle,
  UploadCloud,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/validators/admin';
import { useAdminSession } from '@/components/admin/AdminSessionContext';

interface LegalDoc {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

// P2-2: single source of truth imported from validators/admin.ts — the same
// 4 types the Zod enum enforces server-side. Adding a 5th document type is a
// one-file change instead of three.
const DOC_TYPES = LEGAL_DOCUMENT_TYPES.map((d) => ({
  ...d,
  icon: d.key === 'terms' ? Shield : d.key === 'refund' ? DollarSign : FileSignature,
}));

const EMPTY_STATE_COPY =
  'This document has no content yet. Use the Edit view to add the first version.';

export default function LegalManagement() {
  // L-1b: read current admin session to gate publish button on legal_publish permission.
  const { session } = useAdminSession();
  const canPublish = !!session?.permissions?.includes('legal_publish');

  const [documents, setDocuments] = useState<Record<string, LegalDoc>>({});
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('terms');
  // P2-3: preview was a single boolean shared across all tabs — toggling
  // Preview on Terms also put Privacy into preview mode. Now per-type.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/legal');
      if (!res.ok) {
        toast.error('Failed to load legal documents');
        return;
      }
      const json = await res.json();
      if (json.success) {
        const map: Record<string, LegalDoc> = {};
        const contentMap: Record<string, string> = {};
        for (const doc of json.data || []) {
          map[doc.type] = doc;
          contentMap[doc.type] = doc.content || '';
        }
        setDocuments(map);
        setContents(contentMap);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // P1-4: the old saveDocument ignored res.ok — a 403/500 silently discarded
  // the edit and the UI showed success. Now the response is checked, failures
  // toast, and saves go through a confirmation dialog (an accidental save
  // permanently overwrites the previous version, even with revision history).
  const doSave = async (type: string) => {
    try {
      setSaving(type);
      const docType = DOC_TYPES.find((d) => d.key === type);
      const res = await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          // P2-4: `title` dropped — it was always docType.label in the UI, and
          // the server computes it from LEGAL_DOCUMENT_TYPES anyway. One less
          // source of truth for document titles.
          content: contents[type] || '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || `Failed to save ${docType?.label || type}`);
        return;
      }
      toast.success(`${docType?.label || type} saved`);
      await fetchDocuments();
    } finally {
      setSaving(null);
    }
  };

  const updateContent = (type: string, content: string) => {
    setContents((prev) => ({ ...prev, [type]: content }));
  };

  // W9 / L-1: publish a DRAFT document (rider-visible). Idempotent.
  const [publishing, setPublishing] = useState<string | null>(null);
  const doPublish = async (type: string) => {
    try {
      setPublishing(type);
      const res = await fetch(`/api/admin/legal/${type}/publish`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || `Failed to publish ${type}`);
        return;
      }
      toast.success(`${DOC_TYPES.find((d) => d.key === type)?.label || type} published`);
      await fetchDocuments();
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Legal Documents</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage legal documents and policies</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {DOC_TYPES.map((dt) => {
            const Icon = dt.icon;
            return (
              <TabsTrigger key={dt.key} value={dt.key}>
                <Icon className="h-4 w-4 mr-1" /> {dt.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DOC_TYPES.map((dt) => {
          const isPreviewing = previewing === dt.key;
          return (
            <TabsContent key={dt.key} value={dt.key} className="mt-4">
              <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">{dt.label}</h3>
                    {/* W9 / L-1: draft/published lifecycle badge. */}
                    {documents[dt.key] && (
                      <span
                        className={
                          documents[dt.key].status === 'DRAFT'
                            ? 'inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400'
                            : 'inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {documents[dt.key].status === 'DRAFT' ? 'Draft — not visible to riders' : 'Published'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {documents[dt.key] && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Last updated: {formatDateDDMMYYYY(documents[dt.key].updatedAt)}
                      </div>
                    )}
                    {/* L-1b: Publish button visible only to admins with legal_publish permission.
                        Editors (legal_manage only) see a muted chip instead. */}
                    {documents[dt.key]?.status === 'DRAFT' && canPublish && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={publishing === dt.key}
                        onClick={() => void doPublish(dt.key)}
                      >
                        {publishing === dt.key ? (
                          'Publishing...'
                        ) : (
                          <>
                            <UploadCloud className="h-3.5 w-3.5 mr-1" /> Publish to riders
                          </>
                        )}
                      </Button>
                    )}
                    {documents[dt.key]?.status === 'DRAFT' && !canPublish && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Draft — awaiting publisher
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPreviewing(isPreviewing ? null : dt.key)}
                    >
                      {isPreviewing ? (
                        <EyeOff className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 mr-1" />
                      )}
                      {isPreviewing ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  </div>
                ) : (
                  <>
                    {isPreviewing ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap border rounded-xl p-4 bg-muted/30 min-h-[300px] text-sm">
                        {contents[dt.key] || EMPTY_STATE_COPY}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Content (Plain Text)</Label>
                        <Textarea
                          value={contents[dt.key] || ''}
                          onChange={(e) => updateContent(dt.key, e.target.value)}
                          rows={20}
                          className="font-mono text-sm"
                          placeholder="Enter document content here..."
                        />
                      </div>
                    )}
                    {!isPreviewing && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => setPendingSave(dt.key)}
                          disabled={saving === dt.key}
                        >
                          {saving === dt.key ? (
                            <>Saving...</>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" /> Save {dt.label}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      <AlertDialog open={pendingSave !== null} onOpenChange={(open) => !open && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Save {DOC_TYPES.find((d) => d.key === pendingSave)?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current version will be replaced permanently. The previous
              version is kept in the document revision history for audit.
              {/* W9 / L-1: saves no longer go live instantly. */}
              Saving marks the document as a{' '}
              <span className="font-medium">Draft</span> — riders keep seeing
              the published version until you press "Publish to riders".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSave) {
                  void doSave(pendingSave);
                }
                setPendingSave(null);
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
