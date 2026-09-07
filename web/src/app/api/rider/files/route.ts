import { NextRequest, NextResponse } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { fileRepository } from '@/server/modules/files/files.repository';
import { fileService } from '@/server/modules/files/files.service';

/**
 * EDIT-PROFILE-AUDIT P0-1 (real) (2026-09-08): rider-initiated
 * orphan cleanup for the edit-profile save flow.
 *
 * Flow:
 *   1. Client uploads the new profile photo → server stores it +
 *      creates a `FileRecord` in `PENDING_UPLOAD` status.
 *   2. Client PUTs the profile with the returned URL.
 *   3a. If the PUT succeeds, the rider row is updated with the
 *       URL and the FileRecord is `UPLOADED` + linked.
 *   3b. If the PUT fails (validation, KYC locked, server error,
 *       network drop), the upload sits in storage with no link
 *       from any rider row. Billable. PII. This endpoint
 *       cleans up that case.
 *
 * The client calls `DELETE /api/rider/files?url=<encodedUrl>` from
 * the catch block. The server extracts the storage key from the
 * URL, looks up the FileRecord, verifies ownership, and deletes
 * the file + DB row. Returns 204 on success; 404 if the file
 * doesn't exist (idempotent); 403 if the rider doesn't own it.
 *
 * No PUT-side check: the rider may legitimately delete a
 * successfully-uploaded photo if they tap Cancel. The
 * `FileRecord` is the source of truth for ownership; if the
 * rider has linked this URL into their `profilePhoto` column
 * but then deletes the FileRecord, the rider row will have a
 * dangling URL — the next flatten will return an empty
 * `profilePhoto`. Acceptable; the rider explicitly requested
 * the delete. (A future "profile photo must be present" guard
 * would catch this if product wants it.)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const urlParam = request.nextUrl.searchParams.get('url');
    if (!urlParam) return errors.badRequest('Missing url query param');

    // Extract the storage key from the URL. Local storage uses
    // the proxy path `/api/files/<storageKey>`; S3 + similar
    // use the URL's path component directly. Both shapes
    // pass through this single extraction.
    let storageKey: string;
    try {
      const parsed = new URL(urlParam);
      const proxyMatch = parsed.pathname.match(/^\/api\/files\/(.+)$/);
      storageKey = proxyMatch
        ? decodeURIComponent(proxyMatch[1])
        : decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    } catch {
      return errors.badRequest('Invalid url');
    }

    // Path-traversal guard.
    if (
      storageKey.includes('..') ||
      storageKey.startsWith('/') ||
      storageKey.startsWith('\\')
    ) {
      return errors.badRequest('Invalid storage path');
    }

    const record = await fileRepository.getFileRecordByKey(storageKey);
    if (!record) {
      // Idempotent: treat missing files as success so the
      // client's best-effort retry path doesn't surface
      // spurious 404s.
      return new NextResponse(null, { status: 204 });
    }
    if (record.ownerId !== auth.riderDbId) {
      return errors.forbidden();
    }

    await fileService.deleteFile(record.id, auth.riderDbId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error('[DELETE /api/rider/files]', err);
    return errors.internal('Failed to delete file');
  }
}
