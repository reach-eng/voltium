import { logger } from './logger';
import { getStorageProvider } from './storage';

const fieldsToSign = [
  'profilePhoto',
  'riderPhoto',
  'signature',
  'aadhaarFront',
  'aadhaarBack',
  'panCard',
  'guarantorAadhaarFront',
  'guarantorAadhaarBack',
  'guarantorPan',
  'guarantorVideo',
  'guarantorSignature',
  'guarantorPhoto',
  'proofUrl',
  'pickupPhotoFront',
  'pickupPhotoBack',
  'pickupPhotoLeft',
  'pickupPhotoRight',
  'pickupPhotoWithVehicle',
  'photoFront',
  'photoBack',
  'photoLeft',
  'photoRight',
  'photoSpeedometer',
];

export async function signRiderUrls(rider: any) {
  if (!rider) return rider;

  try {
    const storage = await getStorageProvider();
    return signRiderUrlsWithProvider(rider, storage);
  } catch (err) {
    logger.warn('[signRiderUrls] Storage provider initialization failed, skipping signing:', err);
    return rider;
  }
}

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}
const GLOBAL_SIGNED_URL_CACHE = new Map<string, CachedSignedUrl>();
const SIGNED_URL_TTL_MS = 50 * 60 * 1000; // 50 minutes (for 60-minute signed URLs)

export async function signRiderUrlsWithProvider(
  rider: any,
  storage: any,
  sharedCache?: Map<string, string>
) {
  if (!rider || !storage) return rider;

  const signedRider = { ...rider };
  const signedCache = sharedCache ?? new Map<string, string>();
  const now = Date.now();

  const signingPromises = fieldsToSign.map(async (field) => {
    const rawUrl = signedRider[field];
    if (
      rawUrl &&
      typeof rawUrl === 'string'
    ) {
      if (signedCache.has(rawUrl)) {
        signedRider[field] = signedCache.get(rawUrl)!;
        return;
      }

      // Check global process-level cache to avoid S3/Cloudflare signing calls
      const globalEntry = GLOBAL_SIGNED_URL_CACHE.get(rawUrl);
      if (globalEntry && globalEntry.expiresAt > now) {
        signedRider[field] = globalEntry.url;
        signedCache.set(rawUrl, globalEntry.url);
        return;
      }

      try {
        const signedUrl = await storage.getSignedReadUrl(rawUrl);
        GLOBAL_SIGNED_URL_CACHE.set(rawUrl, {
          url: signedUrl,
          expiresAt: now + SIGNED_URL_TTL_MS,
        });
        signedCache.set(rawUrl, signedUrl);
        signedRider[field] = signedUrl;
      } catch (err) {
        // Only log once per request to avoid flooding if storage is broken
        logger.debug(`[signRiderUrls] Failed to sign ${field}:`, err);
      }
    }
  });

  await Promise.all(signingPromises);

  // Sign nested returnPhotos
  if (signedRider.returnPhotos) {
    await Promise.all(
      Object.keys(signedRider.returnPhotos).map(async (key) => {
        const url = signedRider.returnPhotos[key];
        if (
          url &&
          typeof url === 'string'
        ) {
          try {
            signedRider.returnPhotos[key] = await storage.getSignedReadUrl(url);
          } catch (err) {
            logger.debug(`[signRiderUrls] Failed to sign returnPhotos.${key}:`, err);
          }
        }
      })
    );
  }

  return signedRider;
}
