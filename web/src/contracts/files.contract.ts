import type { ApiResponseSuccess } from '@/lib/api-response';

export interface RequestUploadUrlRequest {
  fileName: string;
  mimeType: string;
  category:
    | 'kyc_document'
    | 'profile_photo'
    | 'vehicle_photo'
    | 'payment_proof'
    | 'support_attachment';
  fileSize: number;
}

export interface RequestUploadUrlResponse {
  uploadUrl: string;
  fileRecordId: string;
  storageKey: string;
  expiresIn: number;
}

export interface ConfirmUploadRequest {
  fileRecordId: string;
  sizeBytes: number;
  checksum?: string;
  idempotencyKey?: string;
}

export interface ConfirmUploadResponse {
  status: string;
}

export interface RequestReadUrlRequest {
  fileRecordId: string;
}

export interface RequestReadUrlResponse {
  readUrl: string;
  expiresIn: number;
}

export type RequestUploadUrlApiResponse = ApiResponseSuccess<RequestUploadUrlResponse>;
export type ConfirmUploadApiResponse = ApiResponseSuccess<ConfirmUploadResponse>;
export type RequestReadUrlApiResponse = ApiResponseSuccess<RequestReadUrlResponse>;
