'use client';

/**
 * Voltium Client-Side Image Compression
 *
 * Compresses images to ~300KB using the browser Canvas API.
 * Used before upload for KYC, vehicle inspection, and support ticket photos.
 *
 * - Supports JPEG, PNG, WebP, GIF input
 * - Outputs JPEG (best compression ratio)
 * - Progressive quality reduction until target size is met
 * - Handles EXIF rotation via automatic Canvas normalization
 */

export interface CompressOptions {
  /** Maximum output file size in bytes. Default: 300 * 1024 (300KB) */
  maxSizeBytes?: number;
  /** Maximum width in pixels. Default: 1920 */
  maxWidth?: number;
  /** Maximum height in pixels. Default: 1920 */
  maxHeight?: number;
  /** Initial JPEG quality (0-1). Default: 0.8 */
  initialQuality?: number;
  /** Minimum quality step to prevent infinite loops. Default: 0.05 */
  qualityStep?: number;
  /** Minimum acceptable quality. Default: 0.1 */
  minQuality?: number;
  /** Output MIME type. Default: 'image/jpeg' */
  outputMime?: string;
}

export interface CompressResult {
  /** Compressed blob */
  blob: Blob;
  /** Compressed data URL */
  dataUrl: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Compressed file size in bytes */
  compressedSize: number;
  /** Compression ratio (0-1, lower = more compression) */
  ratio: number;
  /** Width after resize */
  width: number;
  /** Height after resize */
  height: number;
  /** Output MIME type */
  mime: string;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxSizeBytes: 300 * 1024,
  maxWidth: 1920,
  maxHeight: 1920,
  initialQuality: 0.8,
  qualityStep: 0.05,
  minQuality: 0.1,
  outputMime: 'image/jpeg',
};

/** Supported input image MIME types */
const SUPPORTED_INPUT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

/**
 * Validate that a file is a supported image type
 */
export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_INPUT_TYPES.has(mimeType);
}

/**
 * Get human-readable file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Load an image from a File/Blob and return an HTMLImageElement.
 * Automatically handles EXIF rotation via CSS.
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Calculate the output dimensions, maintaining aspect ratio.
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    height = Math.round((maxWidth / width) * height);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((maxHeight / height) * width);
    height = maxHeight;
  }

  // Ensure minimum dimensions
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

/**
 * Render an image to a canvas and compress to a blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      mime,
      quality
    );
  });
}

/**
 * Compress a single image file to target size.
 *
 * Strategy:
 * 1. Load the image and resize to max dimensions (maintain aspect ratio)
 * 2. Export at initial quality
 * 3. If over target size, progressively reduce quality
 * 4. If still over target at min quality, reduce dimensions further
 *
 * @param file - The image File to compress
 * @param options - Compression options
 * @returns CompressResult with the compressed blob and metadata
 */
export async function compressImage(
  file: File | Blob,
  options?: CompressOptions
): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Validate input type
  if (file.type && !SUPPORTED_INPUT_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported image type: ${file.type}. Supported: ${[...SUPPORTED_INPUT_TYPES].join(', ')}`
    );
  }

  // Load image
  const img = await loadImage(file);

  // Calculate initial dimensions
  let { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let quality = opts.initialQuality;
  let blob: Blob | null = null;

  // Progressive quality reduction loop
  while (quality >= opts.minQuality) {
    canvas.width = width;
    canvas.height = height;

    // Draw with white background (for PNG with transparency)
    if (opts.outputMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);

    blob = await canvasToBlob(canvas, opts.outputMime, quality);

    if (blob.size <= opts.maxSizeBytes) {
      break;
    }

    quality -= opts.qualityStep;
  }

  // If still too large, reduce dimensions
  if (blob && blob.size > opts.maxSizeBytes) {
    const scale = Math.sqrt(opts.maxSizeBytes / blob.size);
    ({ width, height } = calculateDimensions(
      Math.round(width * scale),
      Math.round(height * scale),
      opts.maxWidth,
      opts.maxHeight
    ));

    canvas.width = width;
    canvas.height = height;

    if (opts.outputMime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    blob = await canvasToBlob(canvas, opts.outputMime, opts.minQuality);
  }

  if (!blob) {
    throw new Error('Image compression failed: unable to produce output');
  }

  // Generate data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read compressed blob'));
    reader.readAsDataURL(blob);
  });

  return {
    blob,
    dataUrl,
    originalSize,
    compressedSize: blob.size,
    ratio: blob.size / originalSize,
    width,
    height,
    mime: opts.outputMime,
  };
}

/**
 * Convert a compressed Blob into a File ready for FormData upload.
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type, lastModified: Date.now() });
}
