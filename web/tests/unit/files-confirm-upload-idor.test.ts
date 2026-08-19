import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileUseCases } from '../../src/server/modules/files/files.use-cases';
import { fileRepository } from '../../src/server/modules/files/files.repository';
import { fileService } from '../../src/server/modules/files/files.service';

vi.mock('../../src/server/modules/files/files.repository', () => ({
  fileRepository: {
    getFileRecordById: vi.fn(),
  },
}));

vi.mock('../../src/server/modules/files/files.service', () => ({
  fileService: {
    verifyFileUploaded: vi.fn(),
    markUploaded: vi.fn(),
  },
}));

describe('P0-S2: File Confirm-Upload IDOR Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects confirmation if rider does not own the file record (403 Forbidden)', async () => {
    vi.mocked(fileRepository.getFileRecordById).mockResolvedValue({
      id: 'rec-123',
      ownerId: 'rider-victim',
      status: 'PENDING_UPLOAD',
      storageKey: 'rider-victim/kyc/doc.pdf',
    } as any);

    const actor = { role: 'rider', riderDbId: 'rider-attacker' };

    await expect(
      fileUseCases.confirmUpload('rec-123', 1024, 'checksum-abc', actor)
    ).rejects.toThrow(/Forbidden.*permission/);

    expect(fileService.markUploaded).not.toHaveBeenCalled();
  });

  it('allows confirmation if rider owns the file record', async () => {
    vi.mocked(fileRepository.getFileRecordById).mockResolvedValue({
      id: 'rec-123',
      ownerId: 'rider-legit',
      status: 'PENDING_UPLOAD',
      storageKey: 'rider-legit/kyc/doc.pdf',
    } as any);
    vi.mocked(fileService.verifyFileUploaded).mockResolvedValue(true);
    vi.mocked(fileService.markUploaded).mockResolvedValue({} as any);

    const actor = { role: 'rider', riderDbId: 'rider-legit' };

    const res = await fileUseCases.confirmUpload('rec-123', 1024, 'checksum-abc', actor);
    expect(res.status).toBe('uploaded');
    expect(fileService.markUploaded).toHaveBeenCalledWith('rec-123', 1024, 'checksum-abc');
  });

  it('allows admin with proper privileges to confirm any file upload', async () => {
    vi.mocked(fileRepository.getFileRecordById).mockResolvedValue({
      id: 'rec-123',
      ownerId: 'rider-legit',
      status: 'PENDING_UPLOAD',
      storageKey: 'rider-legit/kyc/doc.pdf',
    } as any);
    vi.mocked(fileService.verifyFileUploaded).mockResolvedValue(true);
    vi.mocked(fileService.markUploaded).mockResolvedValue({} as any);

    const actor = { role: 'admin', adminId: 'admin-1' };

    const res = await fileUseCases.confirmUpload('rec-123', 1024, 'checksum-abc', actor);
    expect(res.status).toBe('uploaded');
    expect(fileService.markUploaded).toHaveBeenCalledWith('rec-123', 1024, 'checksum-abc');
  });
});
