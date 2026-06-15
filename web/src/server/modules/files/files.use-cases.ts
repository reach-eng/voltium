import { createHmac } from 'crypto';
import { fileRepository } from './files.repository';
import { filePolicy } from './files.policy';
import { fileService } from './files.service';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import type { SignedUrlRequest, SignedUrlResponse } from './files.types';
import { FILE_UPLOAD_RULES, FileOwnerType } from './files.types';

export const fileUseCases = {
  /** Generate a one-time upload token tied to a fileRecordId */
  _generateUploadToken(fileRecordId: string): string {
    const secret = process.env.JWT_SECRET || env.JWT_SECRET || 'fallback-secret';
    return createHmac('sha256', secret).update(fileRecordId).digest('hex');
  },

  _verifyUploadToken(fileRecordId: string, token: string): boolean {
    const expected = this._generateUploadToken(fileRecordId);
    // Constant-time comparison to prevent timing attacks
    if (token.length !== expected.length) return false;
    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return result === 0;
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
    const ownerType: FileOwnerType = actor.role === 'admin' ? FileOwnerType.ADMIN : FileOwnerType.RIDER;
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || 'http://localhost:8081';
    const uploadUrl = `${baseUrl}/api/files/local-upload/${record.id}?token=${uploadToken}`;

    return {
      uploadUrl,
      fileRecordId: record.id,
      storageKey,
      uploadToken,
      expiresIn: 3600,
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
      await fileService.logAdminFileView(actor.adminId, fileRecordId, record.purpose, record.ownerId);
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
