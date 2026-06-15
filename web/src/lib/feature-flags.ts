import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface FeatureFlags {
  enableReferralSystem: boolean;
  enableRewardsSystem: boolean;
  enableVehicleAssignment: boolean;
  enableKYCVerification: boolean;
  enableGuarantorRequirement: boolean;
  enableDynamicPricing: boolean;
  enableOfflineMode: boolean;
  enableChatSupport: boolean;
  enablePushNotifications: boolean;
  maxUploadSizeMb: number;
}

const defaultFlags: FeatureFlags = {
  enableReferralSystem: process.env.NEXT_PUBLIC_ENABLE_REFERRAL === 'true',
  enableRewardsSystem: process.env.NEXT_PUBLIC_ENABLE_REWARDS === 'true',
  enableVehicleAssignment: process.env.NEXT_PUBLIC_ENABLE_VEHICLE_ASSIGNMENT !== 'false',
  enableKYCVerification: process.env.NEXT_PUBLIC_ENABLE_KYC !== 'false',
  enableGuarantorRequirement: process.env.NEXT_PUBLIC_ENABLE_GUARANTOR === 'true',
  enableDynamicPricing: process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_PRICING === 'true',
  enableOfflineMode: process.env.NEXT_PUBLIC_ENABLE_OFFLINE === 'true',
  enableChatSupport: process.env.NEXT_PUBLIC_ENABLE_CHAT_SUPPORT === 'true',
  enablePushNotifications: process.env.NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS !== 'false',
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10'),
};

let cachedFlags: FeatureFlags | null = null;
let cacheExpiry = 0;
let pendingPromise: Promise<FeatureFlags> | null = null;
const CACHE_TTL_MS = 30000;

async function loadDbFlags(): Promise<Partial<FeatureFlags>> {
  try {
    const settings = await db.setting.findMany({
      where: { key: { startsWith: 'flag.' } },
    });

    const dbFlags: Partial<FeatureFlags> = {};
    for (const s of settings) {
      const flagKey = s.key.replace('flag.', '');
      if (flagKey in defaultFlags) {
        const typed = flagKey as keyof FeatureFlags;
        if (typeof defaultFlags[typed] === 'boolean') {
          (dbFlags as Record<string, unknown>)[typed] = s.value === 'true';
        } else {
          (dbFlags as Record<string, unknown>)[typed] = parseInt(s.value);
        }
      }
    }
    return dbFlags;
  } catch {
    return {};
  }
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const now = Date.now();
  if (cachedFlags && now < cacheExpiry) {
    return cachedFlags;
  }

  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    try {
      const dbFlags = await loadDbFlags();

      cachedFlags = {
        ...defaultFlags,
        ...dbFlags,
      };
      cacheExpiry = now + CACHE_TTL_MS;

      return cachedFlags;
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
}

export async function isFeatureEnabled(flag: keyof FeatureFlags): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[flag] as boolean;
}

export async function getMaxUploadSize(): Promise<number> {
  const flags = await getFeatureFlags();
  return flags.maxUploadSizeMb * 1024 * 1024;
}

export async function updateFeatureFlag(key: string, value: string): Promise<boolean> {
  try {
    const dbKey = `flag.${key}`;
    await db.setting.upsert({
      where: { key: dbKey },
      update: { value },
      create: { key: dbKey, value },
    });

    cachedFlags = null;
    cacheExpiry = 0;

    logger.info(`[FeatureFlags] Updated flag: ${key} = ${value}`);
    return true;
  } catch (err) {
    logger.error(`[FeatureFlags] Failed to update flag ${key}:`, err);
    return false;
  }
}

export async function getAllFeatureFlags(): Promise<
  Record<string, { value: string; source: string }>
> {
  const flags = await getFeatureFlags();
  const result: Record<string, { value: string; source: string }> = {};

  for (const [key, value] of Object.entries(flags)) {
    result[key] = {
      value: String(value),
      source: 'runtime',
    };
  }

  try {
    const dbSettings = await db.setting.findMany({
      where: { key: { startsWith: 'flag.' } },
    });
    for (const s of dbSettings) {
      const flagKey = s.key.replace('flag.', '');
      if (result[flagKey]) {
        result[flagKey].source = 'database';
        result[flagKey].value = s.value;
      }
    }
  } catch {
    // ignore
  }

  return result;
}
