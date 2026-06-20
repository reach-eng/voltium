import { db } from '@/lib/db';
import type { FileCategory } from './files.types';

export const fileRepository = {
  async createFileRecord(data: {
    ownerType: string;
    ownerId: string;
    purpose: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    checksum?: string;
    visibility?: string;
    metadata?: string;
  }) {
    return db.fileRecord.create({
      data: {
        ownerType: data.ownerType as any,
        ownerId: data.ownerId,
        purpose: data.purpose,
        storageKey: data.storageKey,
        originalName: data.originalName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum,
        visibility: (data.visibility as any) || 'PRIVATE',
        status: 'PENDING_UPLOAD',
        metadata: data.metadata,
      },
    });
  },

  async getFileRecordById(id: string) {
    return db.fileRecord.findUnique({ where: { id } });
  },

  async getFileRecordByKey(storageKey: string) {
    return db.fileRecord.findUnique({ where: { storageKey } });
  },

  async markUploaded(id: string, sizeBytes: number, checksum?: string) {
    return db.fileRecord.update({
      where: { id },
      data: {
        status: 'UPLOADED',
        sizeBytes,
        checksum,
        uploadedAt: new Date(),
      },
    });
  },

  async markStatus(id: string, status: string, reviewedBy?: string) {
    return db.fileRecord.update({
      where: { id },
      data: {
        status: status as any,
        ...(reviewedBy ? { reviewedBy, reviewedAt: new Date() } : {}),
      },
    });
  },

  async getFilesByOwner(ownerType: string, ownerId: string) {
    return db.fileRecord.findMany({
      where: { ownerType: ownerType as any, ownerId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getFilesByPurpose(ownerId: string, purpose: string) {
    return db.fileRecord.findMany({
      where: { ownerId, purpose },
      orderBy: { createdAt: 'desc' },
    });
  },

  async validateUpload(
    mimeType: string,
    fileSize: number,
    category: FileCategory,
    rules: Record<string, { allowedMimeTypes: string[]; maxSizeBytes: number }>
  ): Promise<{ valid: boolean; error?: string }> {
    const rule = rules[category];
    if (!rule) return { valid: false, error: `Unknown file category: ${category}` };

    if (!rule.allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid file type "${mimeType}". Allowed: ${rule.allowedMimeTypes.join(', ')}`,
      };
    }

    if (fileSize > rule.maxSizeBytes) {
      return {
        valid: false,
        error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum: ${(rule.maxSizeBytes / 1024 / 1024).toFixed(0)}MB`,
      };
    }

    return { valid: true };
  },
};
