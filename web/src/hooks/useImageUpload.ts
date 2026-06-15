'use client';

import { useState, useCallback } from 'react';
import {
  compressImage,
  blobToFile,
  formatFileSize,
  isSupportedImageType,
  type CompressOptions,
  type CompressResult,
} from '@/lib/image-compress';
import { uploadFile } from '@/lib/upload';

interface UseImageUploadOptions extends CompressOptions {
  /** Callback when upload succeeds */
  onSuccess?: (url: string, result: CompressResult) => void;
  /** Callback when upload fails */
  onError?: (error: string) => void;
}

interface UseImageUploadReturn {
  /** Currently selected/compressed preview URL */
  previewUrl: string | null;
  /** Upload progress (0-100) */
  progress: number;
  /** Whether compression is happening */
  isCompressing: boolean;
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Last compression result */
  lastResult: CompressResult | null;
  /** Pick and compress an image from file input */
  pickAndCompress: (file: File) => Promise<CompressResult | null>;
  /** Upload the current compressed image */
  upload: (uploadType: string) => Promise<string | null>;
  /** Pick, compress, and upload in one step */
  pickCompressAndUpload: (file: File, uploadType: string) => Promise<string | null>;
  /** Reset state */
  reset: () => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const { onSuccess, onError, ...compressOptions } = options;

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<CompressResult | null>(null);
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(null);

  const reset = useCallback(() => {
    setPreviewUrl(null);
    setProgress(0);
    setIsCompressing(false);
    setIsUploading(false);
    setLastResult(null);
    setCurrentBlob(null);
  }, []);

  const pickAndCompress = useCallback(
    async (file: File): Promise<CompressResult | null> => {
      setIsCompressing(true);
      setProgress(10);

      try {
        // Validate file type
        if (!isSupportedImageType(file.type)) {
          const msg = `Unsupported file type: ${file.type}`;
          onError?.(msg);
          setIsCompressing(false);
          return null;
        }

        // Validate file size (10MB max before compression)
        if (file.size > 10 * 1024 * 1024) {
          const msg = `File too large. Maximum size is 10MB.`;
          onError?.(msg);
          setIsCompressing(false);
          return null;
        }

        setProgress(20);

        // Compress
        const result = await compressImage(file, compressOptions);
        setProgress(60);

        setPreviewUrl(result.dataUrl);
        setCurrentBlob(result.blob);
        setLastResult(result);
        setProgress(100);

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Compression failed';
        onError?.(msg);
        return null;
      } finally {
        setIsCompressing(false);
      }
    },
    [compressOptions, onError]
  );

  const upload = useCallback(
    async (uploadType: string): Promise<string | null> => {
      if (!currentBlob) {
        onError?.('No image to upload. Call pickAndCompress first.');
        return null;
      }

      setIsUploading(true);
      setProgress(10);

      try {
        const ext = currentBlob.type === 'image/jpeg' ? 'jpg' : 'webp';
        const fileName = `voltium-${Date.now()}.${ext}`;

        setProgress(30);

        const fileObj = blobToFile(currentBlob, fileName);
        const url = await uploadFile(fileObj, uploadType);

        setProgress(100);
        onSuccess?.(url, lastResult!);
        return url;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        onError?.(msg);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [currentBlob, onSuccess, onError, lastResult]
  );

  const pickCompressAndUpload = useCallback(
    async (file: File, uploadType: string): Promise<string | null> => {
      const result = await pickAndCompress(file);
      if (!result) return null;
      return upload(uploadType);
    },
    [pickAndCompress, upload]
  );

  return {
    previewUrl,
    progress,
    isCompressing,
    isUploading,
    lastResult,
    pickAndCompress,
    upload,
    pickCompressAndUpload,
    reset,
  };
}
