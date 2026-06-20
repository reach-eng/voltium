'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND_DOMAIN } from '@/lib/branding';

/**
 * Escape a value for safe CSV output.
 * - Wraps in quotes if it contains comma, quote, or newline
 * - Doubles internal quotes per RFC 4180
 * - Prefixes with single quote to prevent formula injection (=, +, -, @)
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';
  const sanitized = str.replace(/"/g, '""');
  if (
    sanitized.startsWith('=') ||
    sanitized.startsWith('+') ||
    sanitized.startsWith('-') ||
    sanitized.startsWith('@')
  ) {
    return `"'${sanitized}"`;
  }
  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r')
  ) {
    return `"${sanitized}"`;
  }
  return sanitized;
}

interface ExportButtonProps {
  data: Record<string, any>[];
  filename?: string;
  columns?: { key: string; label: string }[];
  onExportStart?: () => void;
  onExportProgress?: (progress: number) => void;
  onExportComplete?: () => void;
}

export function ExportButton({
  data,
  filename,
  columns,
  onExportStart,
  onExportProgress,
  onExportComplete,
}: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;

    const total = data.length;
    onExportStart?.();

    const cols = columns || Object.keys(data[0]).map((key) => ({ key, label: key }));
    const header = cols.map((c) => c.label).join(',');

    const rows: string[] = [];
    const batchSize = Math.max(1, Math.floor(total / 10));

    for (let i = 0; i < total; i++) {
      rows.push(cols.map((c) => escapeCsvValue(data[i][c.key])).join(','));
      if ((i + 1) % batchSize === 0 || i === total - 1) {
        const progress = Math.round(((i + 1) / total) * 100);
        onExportProgress?.(progress);
      }
    }

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const defaultFilename =
      filename || `${BRAND_DOMAIN.split('.')[0]}-export-${new Date().toISOString().split('T')[0]}`;
    link.setAttribute('download', `${defaultFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onExportComplete?.();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!data || data.length === 0}
    >
      <Download className="w-4 h-4 mr-2" />
      Export
    </Button>
  );
}
