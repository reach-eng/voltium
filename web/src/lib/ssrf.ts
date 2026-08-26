/**
 * W6 / M-5: shared SSRF guard for admin-supplied gateway endpoints.
 *
 * Extracted from `[id]/test-connection/route.ts` so that create/update
 * can enforce the same rules at WRITE time (previously the check ran
 * only in test-connection, making it advisory — a bad endpoint could be
 * stored and activated without ever being tested).
 */

export function isValidPublicApiEndpoint(value: string | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (value === null || value === undefined || value === '') {
    return { ok: true }; // optional field
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'must use https://' };
  }
  // Disallow obvious SSRF targets. hostname is always a string per
  // the URL spec; the checks below reject the canonical
  // loopback / private / link-local patterns.
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return { ok: false, reason: 'loopback addresses are not allowed' };
  }
  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) {
    return { ok: false, reason: 'private network addresses are not allowed' };
  }
  if (host.startsWith('169.254.')) {
    return { ok: false, reason: 'link-local addresses are not allowed' };
  }
  // 172.16.0.0/12 — RFC 1918
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
    return { ok: false, reason: 'private network addresses are not allowed' };
  }
  return { ok: true };
}
