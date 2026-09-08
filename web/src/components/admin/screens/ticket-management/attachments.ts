'use client';

/** Parse ticket/message attachments stored as JSON array string or legacy CSV. */
export function parseAttachmentUrls(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((u): u is string => typeof u === 'string')
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .slice(0, 5);
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((u): u is string => typeof u === 'string')
          .map((u) => u.trim())
          .filter((u) => u.length > 0)
          .slice(0, 5);
      }
    } catch {
      // Fall through to CSV parsing.
    }
  }
  return trimmed
    .split(',')
    .map((u) => u.trim().replace(/^["[]+|["\]]+$/g, ''))
    .filter((u) => u.length > 0)
    .slice(0, 5);
}
