'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  AlertCircle,
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

interface LegalDoc {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
}

type Locale = 'en' | 'hi';

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
  const [activeLocale, setActiveLocale] = useState<Locale>('en');

  // English state
  const [documents, setDocuments] = useState<Record<string, LegalDoc>>({});
  const [contents, setContents] = useState<Record<string, string>>({});
  // Hindi state
  const [documentsHi, setDocumentsHi] = useState<Record<string, LegalDoc>>({});
  const [contentsHi, setContentsHi] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('terms');
  // P2-3: preview was a single boolean shared across all tabs — toggling
  // Preview on Terms also put Privacy into preview mode. Now per-type.
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<string | null>(null);

  // Active view — selected by locale
  const activeDocs = activeLocale === 'en' ? documents : documentsHi;
  const activeContents = activeLocale === 'en' ? contents : contentsHi;

  const fetchLocale = useCallback(async (locale: Locale) => {
    try {
      const res = await fetch(`/api/admin/legal?locale=${locale}`);
      if (!res.ok) {
        toast.error(`Failed to load ${locale === 'en' ? 'English' : 'Hindi'} legal documents`);
        return;
      }
      const json = await res.json();
      if (json.success) {
        const docMap: Record<string, LegalDoc> = {};
        const contentMap: Record<string, string> = {};
        for (const doc of json.data || []) {
          docMap[doc.type] = doc;
          contentMap[doc.type] = doc.content || '';
        }
        if (locale === 'en') {
          setDocuments(docMap);
          setContents(contentMap);
        } else {
          setDocumentsHi(docMap);
          setContentsHi(contentMap);
        }
      }
    } catch {
      // Error toast handled by res.ok check
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLocale('en'), fetchLocale('hi')]);
    setLoading(false);
  }, [fetchLocale]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // P1-4: the old saveDocument ignored res.ok — a 403/500 silently discarded
  // the edit and the UI showed success. Now the response is checked, failures
  // toast, and saves go through a confirmation dialog (an accidental save
  // permanently overwrites the previous version, even with revision history).
  const doSave = async (type: string) => {
    try {
      setSaving(type);
      const docType = DOC_TYPES.find((d) => d.key === type);
      const currentContents = activeLocale === 'en' ? contents : contentsHi;
      const res = await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          // P2-4: `title` dropped — it was always docType.label in the UI, and
          // the server computes it from LEGAL_DOCUMENT_TYPES anyway.
          content: currentContents[type] || '',
          // LEGAL-AUDIT-P1-3-2026-09-10: locale was never sent, so every
          // save overwrote the English row (the only row the seed created).
          // Now the admin explicitly chooses EN or HI before editing.
          locale: activeLocale,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || `Failed to save ${docType?.label || type}`);
        return;
      }
      toast.success(`${docType?.label || type} (${activeLocale.toUpperCase()}) saved`);
      await fetchDocuments();
    } finally {
      setSaving(null);
    }
  };

  const updateContent = (type: string, content: string) => {
    if (activeLocale === 'en') {
      setContents((prev) => ({ ...prev, [type]: content }));
    } else {
      setContentsHi((prev) => ({ ...prev, [type]: content }));
    }
  };

  // True when Hindi locale is active and there is no Hindi row for this type.
  const missingHi = (type: string) => activeLocale === 'hi' && !documentsHi[type];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Legal Documents</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage legal documents and policies</p>
        </div>
        {/* LEGAL-AUDIT-P1-3-2026-09-10: locale switcher so the admin can
            edit Hindi rows. The server-side upsert is locale-keyed, so saving
            while on HI creates or updates only the Hindi row. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Locale:</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['en', 'hi'] as Locale[]).map((loc) => (
              <button
                key={loc}
                onClick={() => setActiveLocale(loc)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeLocale === loc
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
                }`}
              >
                {loc.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {DOC_TYPES.map((dt) => {
            const Icon = dt.icon;
            const hiMissing = missingHi(dt.key);
            return (
              <TabsTrigger key={dt.key} value={dt.key}>
                <Icon className="h-4 w-4 mr-1" /> {dt.label}
                {hiMissing && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 h-4 px-1 border-amber-400 text-amber-600 dark:text-amber-400 gap-0.5"
                    title="No Hindi translation yet — riders will see English fallback"
                  >
                    <AlertCircle className="h-3 w-3" />
                    HI
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {DOC_TYPES.map((dt) => {
          const isPreviewing = previewing === dt.key;
          const doc = activeDocs[dt.key];
          return (
            <TabsContent key={dt.key} value={dt.key} className="mt-4">
              <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">{dt.label}</h3>
                    <Badge variant="outline" className="text-xs uppercase">
                      {activeLocale}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    {doc && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateDDMMYYYY(doc.updatedAt)}
                      </div>
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

                {/* LEGAL-AUDIT-P1-3-2026-09-10: the amber banner tells the admin
                    they are about to write a Hindi row that does not yet exist.
                    Without this, saving while on HI silently creates a Hindi row
                    and the missing-translation state becomes invisible. */}
                {missingHi(dt.key) && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <strong>No Hindi translation yet.</strong> Saving now will
                      create the Hindi row. Riders who prefer Hindi will see this
                      version; riders without a Hindi preference will fall back to
                      English.
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                  </div>
                ) : (
                  <>
                    {isPreviewing ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap border rounded-xl p-4 bg-muted/30 min-h-[300px] text-sm">
                        {activeContents[dt.key] || EMPTY_STATE_COPY}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Content (Plain Text)</Label>
                        <Textarea
                          value={activeContents[dt.key] || ''}
                          onChange={(e) => updateContent(dt.key, e.target.value)}
                          rows={20}
                          className="font-mono text-sm"
                          placeholder={
                            missingHi(dt.key)
                              ? 'No Hindi translation yet. Enter Hindi content here...'
                              : 'Enter document content here...'
                          }
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
                              <Save className="h-4 w-4 mr-1" /> Save {dt.label} ({activeLocale.toUpperCase()})
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
              Save {DOC_TYPES.find((d) => d.key === pendingSave)?.label} ({activeLocale.toUpperCase()})?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current {activeLocale === 'en' ? 'English' : 'Hindi'} version will be
              replaced permanently. The previous version is kept in the document
              revision history for audit. The rider-facing document updates within
              approximately 5 minutes.
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
