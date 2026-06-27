/**
 * Server-side Image Optimization Pipeline.
 *
 * Uses Sharp to compress/resize KYC uploads, payment proofs, and profile photos.
 * Converts to WebP where beneficial, generates thumbnails for listing views.
 *
 * Run only when image processing deps are installed:
 *   npm install sharp
 */
import { logger } from '@/lib/logger';

export interface ImageOptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
}

const PRESETS: Record<string, ImageOptimizationOptions> = {
  kyc_document: { maxWidth: 2000, maxHeight: 2000, quality: 85, format: 'jpeg' },
  profile_photo: { maxWidth: 512, maxHeight: 512, quality: 80, format: 'webp' },
  payment_proof: { maxWidth: 2000, maxHeight: 2000, quality: 85, format: 'jpeg' },
  vehicle_photo: { maxWidth: 1600, maxHeight: 1600, quality: 80, format: 'jpeg' },
  support_attachment: { maxWidth: 2000, maxHeight: 2000, quality: 80, format: 'jpeg' },
  thumbnail: { maxWidth: 256, maxHeight: 256, quality: 70, format: 'webp' },
};

let sharpAvailable = false;

async function loadSharp(): Promise<boolean> {
  if (sharpAvailable) return true;
  try {
    const sharp = (await import('sharp')).default;
    sharpAvailable = true;
    return true;
  } catch {
    logger.warn('[ImageOptimizer] Sharp not available — install with: npm install sharp');
    return false;
  }
}

export async function optimizeImage(
  inputBuffer: Buffer,
  category: string
): Promise<{ data: Buffer; format: string; width: number; height: number }> {
  const sharp = await tryLoadSharp();
  if (!sharp) {
    return { data: inputBuffer, format: 'original', width: 0, height: 0 };
  }

  const preset = PRESETS[category] || PRESETS.kyc_document;
  const metadata = await sharp(inputBuffer).metadata();

  const result = await sharp(inputBuffer)
    .resize(preset.maxWidth, preset.maxHeight, { fit: 'inside', withoutEnlargement: true })
    [preset.format]({ quality: preset.quality })
    .toBuffer();

  return {
    data: result,
    format: preset.format,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

export async function generateThumbnail(inputBuffer: Buffer): Promise<Buffer> {
  const sharp = await tryLoadSharp();
  if (!sharp) return inputBuffer;

  return sharp(inputBuffer)
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 70 })
    .toBuffer();
}

async function tryLoadSharp(): Promise<any> {
  if (!sharpAvailable) {
    const loaded = await loadSharp();
    if (!loaded) return null;
  }
  const sharp = (await import('sharp')).default;
  return sharp;
}
