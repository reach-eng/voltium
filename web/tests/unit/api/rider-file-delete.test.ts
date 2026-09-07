import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// EDIT-PROFILE-AUDIT P0-1 (real) (2026-09-08): orphan cleanup.
// Verify the new DELETE /api/rider/files endpoint:
//   - 204 on owned file
//   - 403 on another rider's file
//   - 204 (idempotent) on missing file
//   - 400 on missing url
//   - 400 on path-traversal attempts
//   - 401 when unauthenticated

const requireRiderSessionMock = vi.fn();
const fileRepositoryMock = {
  getFileRecordByKey: vi.fn(),
  getFileRecordById: vi.fn(),
  deleteFileRecord: vi.fn(),
};
const fileServiceMock = {
  deleteFile: vi.fn(),
};

vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: (...args: unknown[]) => requireRiderSessionMock(...args),
}));
vi.mock('@/server/modules/files/files.repository', () => ({
  fileRepository: fileRepositoryMock,
}));
vi.mock('@/server/modules/files/files.service', () => ({
  fileService: fileServiceMock,
}));

const { DELETE } = await import('@/app/api/rider/files/route');

const RIDER = { riderDbId: 'rider-1', phone: '9876543210' };
const OWNED = {
  id: 'file-1',
  ownerId: 'rider-1',
  storageKey: 'rider-1/profile_photo/1700000000-photo.jpg',
  status: 'UPLOADED',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
};

function makeDelete(url: string | null): NextRequest {
  const req = new NextRequest(
    `http://localhost/api/rider/files${url ? `?url=${encodeURIComponent(url)}` : ''}`,
    { method: 'DELETE' }
  );
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRiderSessionMock.mockResolvedValue(RIDER);
  fileRepositoryMock.getFileRecordByKey.mockResolvedValue(null);
  fileServiceMock.deleteFile.mockResolvedValue(undefined);
});

describe('DELETE /api/rider/files — P0-1 orphan cleanup', () => {
  it('returns 401 when no rider session is present', async () => {
    requireRiderSessionMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })
    );
    const res = await DELETE(makeDelete('http://localhost/api/files/foo.jpg'));
    expect(res.status).toBe(401);
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
  });

  it('returns 400 when the url query param is missing', async () => {
    const res = await DELETE(makeDelete(null));
    expect(res.status).toBe(400);
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
  });

  it('returns 204 on a file owned by the rider (happy path)', async () => {
    fileRepositoryMock.getFileRecordByKey.mockResolvedValueOnce(OWNED);
    const url = `http://localhost/api/files/${OWNED.storageKey}`;
    const res = await DELETE(makeDelete(url));
    expect(res.status).toBe(204);
    expect(fileServiceMock.deleteFile).toHaveBeenCalledWith(OWNED.id, RIDER.riderDbId);
  });

  it('returns 204 idempotently when the file does not exist', async () => {
    // getFileRecordByKey returns null (default). The client retry
    // path should not surface spurious 404s.
    const res = await DELETE(makeDelete('http://localhost/api/files/does-not-exist.jpg'));
    expect(res.status).toBe(204);
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
  });

  it('returns 403 when the file is owned by another rider', async () => {
    fileRepositoryMock.getFileRecordByKey.mockResolvedValueOnce({
      ...OWNED,
      ownerId: 'rider-2',
    });
    const res = await DELETE(makeDelete(`http://localhost/api/files/${OWNED.storageKey}`));
    expect(res.status).toBe(403);
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
  });

  it('returns 400 on path-traversal attempts', async () => {
    // ../../etc/passwd — the route's traversal guard rejects.
    const res = await DELETE(makeDelete('http://localhost/api/files/..%2F..%2Fetc%2Fpasswd'));
    expect(res.status).toBe(400);
    expect(fileServiceMock.deleteFile).not.toHaveBeenCalled();
  });

  it('handles S3-style URLs (path is the storage key)', async () => {
    // The upload URL for S3 looks like
    // https://bucket.s3.amazonaws.com/<storageKey>. The route
    // treats the path component as the storage key when the
    // proxy prefix doesn't match.
    fileRepositoryMock.getFileRecordByKey.mockResolvedValueOnce(OWNED);
    const url = `https://bucket.s3.amazonaws.com/${OWNED.storageKey}`;
    const res = await DELETE(makeDelete(url));
    expect(res.status).toBe(204);
    expect(fileServiceMock.deleteFile).toHaveBeenCalledWith(OWNED.id, RIDER.riderDbId);
  });
});
