import { createHmac } from 'crypto';
import { fileRepository } from './files.repository';
import { filePolicy } from './files.policy';
import { fileService } from './files.service';
import { env } from '@/lib/env';
import type { SignedUrlRequest, SignedUrlResponse } from './files.types';
import { FILE_UPLOAD_RULES, FileOwnerType } from './files.types';

export const fileUseCases = {
  /** Token TTL: 15 minutes (in seconds) */
  UPLOAD_TOKEN_TTL_SECONDS: 15 * 60,

  /** Generate an upload token tied to a fileRecordId with a 15-minute expiry.
   *  Token format: `<expiry_epoch_ms>.<hmac>` */
  _generateUploadToken(fileRecordId: string): string {
    const secret = process.env.JWT_SECRET || env.JWT_SECRET || 'fallback-secret';
    const expiresAt = Date.now() + this.UPLOAD_TOKEN_TTL_SECONDS * 1000;
    const payload = `${fileRecordId}:${expiresAt}`;
    const hmac = createHmac('sha256', secret).update(payload).digest('hex');
    return `${expiresAt}.${hmac}`;
  },

  _verifyUploadToken(fileRecordId: string, token: string): boolean {
    try {
      const dotIndex = token.indexOf('.');
      if (dotIndex === -1) return false;
      const expiresAt = parseInt(token.slice(0, dotIndex), 10);
      const providedHmac = token.slice(dotIndex + 1);
      if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
      const secret = process.env.JWT_SECRET || env.JWT_SECRET || 'fallback-secret';
      const payload = `${fileRecordId}:${expiresAt}`;
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      // Constant-time comparison to prevent timing attacks
      if (providedHmac.length !== expected.length) return false;
      let result = 0;
      for (let i = 0; i < providedHmac.length; i++) {
        result |= providedHmac.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      return result === 0;
    } catch {
      return false;
    }
  },

  async requestUploadUrl(
    input: SignedUrlRequest,
    actor: { role: string; riderDbId?: string; adminId?: string }
  ): Promise<SignedUrlResponse & { fileRecordId: string }> {
    const validation = await fileRepository.validateUpload(
      input.mimeType,
      input.fileSize,
      input.category,
      FILE_UPLOAD_RULES
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const ownerId = actor.riderDbId || actor.adminId || 'unknown';
    const ownerType: FileOwnerType =
      actor.role === 'admin' ? FileOwnerType.ADMIN : FileOwnerType.RIDER;
    const storageKey = fileService.generateStorageKey(ownerId, input.category, input.fileName);

    const record = await fileService.createFileRecord({
      ownerType,
      ownerId,
      purpose: input.category,
      storageKey,
      originalName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.fileSize,
      metadata: JSON.stringify({ requestedBy: actor.adminId || actor.riderDbId }),
    });

    // Generate a one-time upload token for local_laptop mode
    const uploadToken = fileUseCases._generateUploadToken(record.id);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:8081';
    const uploadUrl = `${baseUrl}/api/files/local-upload/${record.id}?token=${uploadToken}`;

    return {
      uploadUrl,
      fileRecordId: record.id,
      storageKey,
      uploadToken,
      expiresIn: 900,
    };
  },

  async confirmUpload(
    fileRecordId: string,
    sizeBytes: number,
    checksum?: string
  ): Promise<{ status: string }> {
    const record = await fileRepository.getFileRecordById(fileRecordId);
    if (!record) {
      throw new Error(`FileRecord ${fileRecordId} not found`);
    }
    if (record.status !== 'PENDING_UPLOAD') {
      return { status: record.status.toLowerCase() };
    }

    const uploaded = await fileService.verifyFileUploaded(record.storageKey);
    if (!uploaded) {
      throw new Error('File not found in storage. Upload the file first.');
    }

    await fileService.markUploaded(fileRecordId, sizeBytes, checksum);

    return { status: 'uploaded' };
  },

  async requestReadUrl(
    fileRecordId: string,
    actor: { role: string; riderDbId?: string; adminId?: string; permissions?: string[] }
  ): Promise<{ readUrl: string; expiresIn: number }> {
    const record = await fileRepository.getFileRecordById(fileRecordId);
    if (!record) {
      throw new Error('File not found');
    }

    if (!filePolicy.canViewFile(actor, record)) {
      throw new Error('You do not have permission to view this file');
    }

    if (actor.role === 'admin' && actor.adminId) {
      await fileService.logAdminFileView(
        actor.adminId,
        fileRecordId,
        record.purpose,
        record.ownerId
      );
    }

    const readUrl = await fileService.getSignedReadUrl(record.storageKey, 15);

    return { readUrl, expiresIn: 900 };
  },

  async getFileRecord(id: string) {
    return fileRepository.getFileRecordById(id);
  },

  async getFilesByOwner(ownerType: string, ownerId: string) {
    return fileRepository.getFilesByOwner(ownerType, ownerId);
  },

  async verifyFileAccess(
    fileRecordId: string,
    actor: { role: string; riderDbId?: string; adminId?: string; permissions?: string[] }
  ): Promise<{ allowed: boolean; reason?: string }> {
    const record = await fileRepository.getFileRecordById(fileRecordId);
    if (!record) {
      return { allowed: false, reason: 'File not found' };
    }

    if (!filePolicy.canViewFile(actor, record)) {
      return { allowed: false, reason: 'You do not have permission to access this file' };
    }

    return { allowed: true };
  },
};
