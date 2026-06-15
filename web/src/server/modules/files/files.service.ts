import { getStorageProvider } from '@/lib/storage';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { fileRepository } from './files.repository';
import { filePolicy } from './files.policy';
import type { FileCategory, FileOwnerType } from './files.types';
import { FILE_UPLOAD_RULES } from './files.types';

export const fileService = {
  async validateUpload(category: FileCategory, mimeType: string, fileSize: number): Promise<{ valid: boolean; error?: string }> {
    return fileRepository.validateUpload(mimeType, fileSize, category, FILE_UPLOAD_RULES);
  },

  generateStorageKey(ownerId: string, category: FileCategory, fileName: string): string {
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${ownerId}/${category}/${timestamp}-${safeName}`;
  },

  async createFileRecord(params: {
    ownerType: FileOwnerType;
    ownerId: string;
    purpose: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    checksum?: string;
    metadata?: string;
  }) {
    const record = await fileRepository.createFileRecord({
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      purpose: params.purpose,
      storageKey: params.storageKey,
      originalName: params.originalName,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      checksum: params.checksum,
      metadata: params.metadata,
    });

    logger.info('[FileService] FileRecord created', {
      id: record.id,
      purpose: params.purpose,
      storageKey: params.storageKey,
    });

    return record;
  },

  async markUploaded(fileRecordId: string, sizeBytes: number, checksum?: string) {
    return fileRepository.markUploaded(fileRecordId, sizeBytes, checksum);
  },

  async getFileRecordById(id: string) {
    return fileRepository.getFileRecordById(id);
  },

  async getFilesByOwner(ownerType: string, ownerId: string) {
    return fileRepository.getFilesByOwner(ownerType, ownerId);
  },

  async getSignedUploadUrl(storageKey: string, contentType: string): Promise<string> {
    const storage = await getStorageProvider();
    return storage.getSignedUploadUrl(storageKey, contentType);
  },

  async getSignedReadUrl(storageKey: string, expiresInMinutes = 15): Promise<string> {
    const storage = await getStorageProvider();
    return storage.getSignedReadUrl(storageKey, expiresInMinutes);
  },

  async verifyFileUploaded(storageKey: string): Promise<boolean> {
    const storage = await getStorageProvider();
    return storage.verifyUpload(storageKey);
  },

  async logAdminFileView(adminId: string, fileRecordId: string, filePurpose: string, ownerId: string): Promise<void> {
    await createAuditLog({
      actorId: adminId,
      actorType: 'admin',
      action: 'file.admin_view',
      entity: 'fileRecord',
      entityId: fileRecordId,
      details: { purpose: filePurpose, ownerId },
    });
  },

  canViewFile(actor: { role: string; permissions?: string[]; riderDbId?: string }, fileRecord: { ownerId: string; purpose: string; visibility: string }): boolean {
    return filePolicy.canViewFile(actor, fileRecord);
  },
};
