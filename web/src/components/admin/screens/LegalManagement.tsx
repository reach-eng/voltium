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
  ScrollText,
  FileSignature,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LegalDoc {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
}

const DOC_TYPES: { key: string; label: string; icon: any }[] = [
  { key: 'terms', label: 'Terms of Service', icon: Shield },
  { key: 'privacy', label: 'Privacy Policy', icon: EyeOff },
  { key: 'refund', label: 'Refund Policy', icon: DollarSign },
  { key: 'lease', label: 'Lease Agreement', icon: FileSignature },
];

export default function LegalManagement() {
  const [documents, setDocuments] = useState<Record<string, LegalDoc>>({});
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('terms');
  const [previewing, setPreviewing] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/legal');
      if (!res.ok) return;
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

  const saveDocument = async (type: string) => {
    try {
      setSaving(type);
      const docType = DOC_TYPES.find((d) => d.key === type);
      await fetch('/api/admin/legal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: docType?.label || type,
          content: contents[type] || '',
        }),
      });
      fetchDocuments();
    } finally {
      setSaving(null);
    }
  };

  const updateContent = (type: string, content: string) => {
    setContents((prev) => ({ ...prev, [type]: content }));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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

        {DOC_TYPES.map((dt) => (
          <TabsContent key={dt.key} value={dt.key} className="mt-4">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">{dt.label}</h3>
                </div>
                <div className="flex items-center gap-3">
                  {documents[dt.key] && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Last updated: {formatDate(documents[dt.key].updatedAt)}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setPreviewing(!previewing)}
                  >
                    {previewing ? (
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 mr-1" />
                    )}
                    {previewing ? 'Edit' : 'Preview'}
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
                  {previewing ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap border rounded-xl p-4 bg-muted/30 min-h-[300px] text-sm">
                      {contents[dt.key] || 'No content yet.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Content (Markdown / Plain Text)</Label>
                      <Textarea
                        value={contents[dt.key] || ''}
                        onChange={(e) => updateContent(dt.key, e.target.value)}
                        rows={20}
                        className="font-mono text-sm"
                        placeholder="Enter document content here..."
                      />
                    </div>
                  )}
                  {!previewing && (
                    <div className="flex justify-end">
                      <Button onClick={() => saveDocument(dt.key)} disabled={saving === dt.key}>
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
        ))}
      </Tabs>
    </div>
  );
}
