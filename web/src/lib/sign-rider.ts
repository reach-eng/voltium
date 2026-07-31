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

export async function signRiderUrls(rider: any, externalCache?: Map<string, string>) {
  if (!rider) return rider;

  try {
    const storage = await getStorageProvider();
    return signRiderUrlsWithProvider(rider, storage, externalCache);
  } catch (err) {
    logger.warn('[signRiderUrls] Storage provider initialization failed, skipping signing:', err);
    return rider;
  }
}

export async function signRiderUrlsWithProvider(rider: any, storage: any, externalCache?: Map<string, string>) {
  if (!rider || !storage) return rider;

  const signedRider = { ...rider };
  const signedCache = externalCache ?? new Map<string, string>();

  const signingPromises = fieldsToSign.map(async (field) => {
    const url = signedRider[field];
    if (
      url &&
      typeof url === 'string'
    ) {
      if (signedCache.has(url)) {
        signedRider[field] = signedCache.get(url)!;
        return;
      }

      try {
        const signedUrl = await storage.getSignedReadUrl(url);
        signedCache.set(url, signedUrl);
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
