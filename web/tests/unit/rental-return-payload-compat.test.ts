import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// PR-VER-2026-08-06 (RENTAL P0-1): the return route previously accepted SIX
// shapes (returnPhotos, photoUrls, riderId, + 4 named photo fields) as a
// band-aid for client drift. The canonical shape is now exactly ONE:
//   { returnPhotos: string[], reason?, latitude?, longitude? }
// Legacy shapes (photoUrls / riderId / named fields) now fail validation.

const mocks = vi.hoisted(() => ({
  submitReturn: vi.fn(),
  requireRiderSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/rider-auth', () => ({
  requireRiderSession: mocks.requireRiderSession,
}));
vi.mock('@/server/modules/rentals/use-cases/submitReturn', () => ({
  submitReturn: mocks.submitReturn,
}));

import { POST } from '@/app/api/rider/rental/return/route';

const FOUR_PHOTOS = [
  'http://img1.jpg',
  'http://img2.jpg',
  'http://img3.jpg',
  'http://img4.jpg',
];

describe('Rental Return Payload — canonical shape (RENTAL P0-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRiderSession.mockResolvedValue({ riderDbId: 'r_db_1' });
    mocks.submitReturn.mockResolvedValue({ returnId: 'ret_1' });
  });

  it('accepts the canonical returnPhotos shape from the Flutter client', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        returnPhotos: FOUR_PHOTOS,
        reason: 'End of trip',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.submitReturn).toHaveBeenCalledWith('r_db_1', {
      photoUrls: FOUR_PHOTOS,
      reason: 'End of trip',
      latitude: undefined,
      longitude: undefined,
    });
  });

  it('rejects the legacy photoUrls shape with 422', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        riderId: 'r_1',
        photoUrls: FOUR_PHOTOS,
        reason: 'End of trip',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    expect(mocks.submitReturn).not.toHaveBeenCalled();
  });

  it('rejects the legacy named photo fields (photoLeft etc.) with 422', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({
        photoLeft: FOUR_PHOTOS[0],
        photoRight: FOUR_PHOTOS[1],
        photoFront: FOUR_PHOTOS[2],
        photoBack: FOUR_PHOTOS[3],
        reason: 'End of trip',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    expect(mocks.submitReturn).not.toHaveBeenCalled();
  });

  it('rejects an out-of-contract riderId-only body with 422', async () => {
    const req = new NextRequest('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({ riderId: 'r_1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});
