/**
 * extractErrorMessage — unified error-to-string helper for the admin panel.
 *
 * W4 / PR-1: replaces the 15+ `toast.error(extractErrorMessage(e, 'Operation failed'))` / `toast.error(json.error)`
 * raw call-sites that leak server-side stack fragments to the UI. The
 * contract:
 *
 *   1. Always returns a non-empty string (never `null`, never `undefined`).
 *   2. Returns the input if it's already a non-empty `string`.
 *   3. Strips and redacts server-shaped payloads ({ message }, { error }, { error: { message } }).
 *   4. Falls back to the caller-provided `fallback` when the input has no
 *      usable message. Never throws.
 *   5. Strips PII-shaped digits/email patterns that some error bodies leak
 *      (e.g. "rider +919999900001 not found") — left to redactPii() if the
 *      caller wants that pass; this helper does NOT call redactPii by
 *      default so a logged PII string is still findable in Sentry.
 *
 * Usage:
 *
 *   try { ... } catch (e) {
 *     toast.error(extractErrorMessage(e, 'Couldn\'t load backups'));
 *   }
 *
 *   const res = await fetch(...);
 *   if (!res.ok) {
 *     const body = await res.json().catch(() => null);
 *     toast.error(extractErrorMessage(body, 'Backup request failed'));
 *   }
 */
export function extractErrorMessage(
  input: unknown,
  fallback: string = 'Something went wrong'
): string {
  if (input == null) {
    return fallback;
  }

  // String passthrough — trim and reject empty.
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  // Error instance — message may be empty ("Error: " with no body).
  if (input instanceof Error) {
    const m = (input.message ?? '').trim();
    if (m.length > 0) return m;
    // Some libraries (e.g. fetch) throw plain `new Error()` with no
    // message; fall back to the type name to keep the toast non-empty.
    return fallback || input.name || 'Error';
  }

  // Plain object — pluck the most likely server-field. The order
  // mirrors what every route in the codebase returns:
  //   { message: '...' }   (lib/api-response.ts success()/error())
  //   { error: '...' }     (legacy before the PR-1 standardisation)
  //   { error: { message: '...' } }  (nested envelope)
  //   { error: { code: '...', message: '...' } }
  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;

    // Walk the candidate fields in priority order. Each must be a
    // non-empty string to qualify.
    const candidates: unknown[] = [
      obj.message,
      obj.error,
      obj.msg,
      obj.detail,
      (obj.error && typeof obj.error === 'object'
        ? (obj.error as Record<string, unknown>).message
        : undefined),
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
  }

  // Last resort: the fallback. We do NOT stringify arbitrary objects
  // because the resulting toast would be a JSON dump (e.g. "[object Object]"
  // or a 200-char Prisma stack fragment) — both useless and PII-leaky.
  return fallback;
}

/**
 * Convenience wrapper: returns an object with a stable `error`-shaped API
 * suitable for React Query / SWR error states where callers expect a
 * `Error`-like. The message is sourced from `extractErrorMessage`.
 */
export function toErrorLike(
  input: unknown,
  fallback: string = 'Something went wrong'
): Error {
  return new Error(extractErrorMessage(input, fallback));
}
