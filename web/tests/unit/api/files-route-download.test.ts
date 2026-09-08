import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/get-session', () => ({
  getSession: vi.fn(),
  getAdminSession: vi.fn(),
}));

vi.mock('@/server/modules/files/files.repository', () => ({
  fileRepository: {
    getFileRecordByKey: vi.fn(),
    getFileRecordById: vi.fn(),
  },
}));

vi.mock('@/server/modules/files/files.service', () => ({
  fileService: {
    canViewFile: vi.fn(),
    logAdminFileView: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake image content')),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue({ value: 'D:\\voltium\\data\\uploads' }),
    },
  },
}));

import { GET } from '@/app/api/files/[...path]/route';
import { getSession, getAdminSession } from '@/lib/get-session';
import { fileRepository } from '@/server/modules/files/files.repository';
import { fileService } from '@/server/modules/files/files.service';

describe('GET /api/files/[...path] — Download Prefix and Avatar Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips leading download path segment and resolves file record by key', async () => {
    (getSession as any).mockResolvedValue(null);
    (getAdminSession as any).mockResolvedValue(null);

    (fileRepository.getFileRecordByKey as any).mockResolvedValue({
      id: 'file-1',
      storageKey: 'riders/cm123/avatar.jpg',
      originalName: 'avatar.jpg',
      purpose: 'profile_photo',
      visibility: 'PUBLIC',
      ownerId: 'cm123',
    });

    const request = new NextRequest('http://localhost:8081/api/files/download/riders/cm123/avatar.jpg');
    const params = Promise.resolve({ path: ['download', 'riders', 'cm123', 'avatar.jpg'] });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    expect(fileRepository.getFileRecordByKey).toHaveBeenCalledWith('riders/cm123/avatar.jpg');
  });

  it('allows unauthenticated requests for public profile photos without session', async () => {
    (getSession as any).mockResolvedValue(null);
    (getAdminSession as any).mockResolvedValue(null);

    (fileRepository.getFileRecordByKey as any).mockResolvedValue({
      id: 'file-2',
      storageKey: 'riders/cm456/profile_photo.jpg',
      originalName: 'profile_photo.jpg',
      purpose: 'profile_photo',
      visibility: 'PRIVATE', // purpose is profile_photo -> allowed unauthenticated for UI renderers
      ownerId: 'cm456',
    });

    const request = new NextRequest('http://localhost:8081/api/files/riders/cm456/profile_photo.jpg');
    const params = Promise.resolve({ path: ['riders', 'cm456', 'profile_photo.jpg'] });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    expect(fileService.canViewFile).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401 when file is private and not a profile photo', async () => {
    (getSession as any).mockResolvedValue(null);
    (getAdminSession as any).mockResolvedValue(null);

    (fileRepository.getFileRecordByKey as any).mockResolvedValue({
      id: 'file-3',
      storageKey: 'riders/cm789/kyc/aadhaar.pdf',
      originalName: 'aadhaar.pdf',
      purpose: 'kyc_document',
      visibility: 'PRIVATE',
      ownerId: 'cm789',
    });

    const request = new NextRequest('http://localhost:8081/api/files/download/riders/cm789/kyc/aadhaar.pdf');
    const params = Promise.resolve({ path: ['download', 'riders', 'cm789', 'kyc', 'aadhaar.pdf'] });

    const response = await GET(request, { params });
    expect(response.status).toBe(401);
  });

  it('allows authenticated rider to view their own private file', async () => {
    (getSession as any).mockResolvedValue({ riderDbId: 'cm789' });
    (getAdminSession as any).mockResolvedValue(null);

    (fileRepository.getFileRecordByKey as any).mockResolvedValue({
      id: 'file-3',
      storageKey: 'riders/cm789/kyc/aadhaar.pdf',
      originalName: 'aadhaar.pdf',
      purpose: 'kyc_document',
      visibility: 'PRIVATE',
      ownerId: 'cm789',
    });

    (fileService.canViewFile as any).mockReturnValue(true);

    const request = new NextRequest('http://localhost:8081/api/files/download/riders/cm789/kyc/aadhaar.pdf');
    const params = Promise.resolve({ path: ['download', 'riders', 'cm789', 'kyc', 'aadhaar.pdf'] });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    expect(fileService.canViewFile).toHaveBeenCalledWith(
      { role: 'rider', riderDbId: 'cm789' },
      expect.anything()
    );
  });
});
