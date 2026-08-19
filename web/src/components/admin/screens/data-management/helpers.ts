/**
 * Shared formatting and UI helper functions for Data Management tabs.
 */

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

export function getStatusBadge(status?: string | null): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCESS':
      return { variant: 'default', label: 'Completed' };
    case 'RUNNING':
    case 'IN_PROGRESS':
      return { variant: 'secondary', label: 'Running' };
    case 'FAILED':
      return { variant: 'destructive', label: 'Failed' };
    case 'PENDING':
      return { variant: 'outline', label: 'Pending' };
    default:
      return { variant: 'outline', label: status || 'Unknown' };
  }
}

export function getTypeBadge(type?: string | null): { variant: 'default' | 'secondary' | 'outline'; label: string } {
  switch (type) {
    case 'SCHEDULED':
      return { variant: 'default', label: 'Scheduled' };
    case 'MANUAL':
      return { variant: 'secondary', label: 'Manual' };
    case 'PRE_RESTORE':
      return { variant: 'outline', label: 'Pre-Restore' };
    default:
      return { variant: 'outline', label: type || 'Other' };
  }
}

export function getStoragePercent(used: number, total: number): number {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
