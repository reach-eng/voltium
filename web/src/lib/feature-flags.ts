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

export const FLAG_LABELS: Record<string, string> = {
  enableReferralSystem: 'Referral System',
  enableRewardsSystem: 'Rewards & Loyalty System',
  enableVehicleAssignment: 'Vehicle Assignment Flow',
  enableKYCVerification: 'Mandatory KYC Verification',
  enableGuarantorRequirement: 'Guarantor Requirement for Rentals',
  enableDynamicPricing: 'Dynamic Pricing Engine',
  enableOfflineMode: 'Offline Mode Support',
  enableChatSupport: 'In-App Support Chat',
  enablePushNotifications: 'Push Notifications Channel',
  maxUploadSizeMb: 'Maximum File Upload Size (MB)',
};

export const FLAG_DESCRIPTIONS: Record<string, string> = {
  enableReferralSystem: 'Allow riders to invite friends and earn referral rewards.',
  enableRewardsSystem: 'Enable points earning and reward redemption catalog.',
  enableVehicleAssignment: 'Require explicit vehicle-to-rider matching before rental starts.',
  enableKYCVerification: 'Block rental bookings until Aadhaar & DL are verified.',
  enableGuarantorRequirement: 'Require a verified guarantor for high-value vehicle rentals.',
  enableDynamicPricing: 'Apply peak-demand and location-based rate adjustments.',
  enableOfflineMode: 'Allow mobile app to cache data and operate with limited connectivity.',
  enableChatSupport: 'Enable live support ticket chat in the mobile app.',
  enablePushNotifications: 'Send transactional push notifications via Firebase Cloud Messaging.',
  maxUploadSizeMb: 'Global limit for image and document uploads across all endpoints.',
};

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
/**
 * Raw DB overrides loaded in the SAME query as cachedFlags (P2-21, 2026-08-05
 * ops audit). getAllFeatureFlags previously issued a SECOND findMany just to
 * tag which flags came from the DB — doubling the query on a read-heavy admin
 * screen. Both are populated together and invalidated together.
 */
let cachedDbOverrides: Record<string, string> | null = null;
let cacheExpiry = 0;
// P2-19: the module cache is a per-instance optimization. The pendingPromise
// below already dedupes concurrent requests within an instance (the audit
// worried about a race — it is exactly what pendingPromise prevents), and
// updateFeatureFlag clears the cache globally. In multi-pod deployments each
// pod re-reads at most every CACHE_TTL_MS — acceptable for flag data.
let pendingPromise: Promise<FeatureFlags> | null = null;
const CACHE_TTL_MS = 300_000; // 5 minutes (invalidates instantly on updateFeatureFlag)

async function loadDbFlags(): Promise<{
  dbFlags: Partial<FeatureFlags>;
  dbOverrides: Record<string, string>;
}> {
  try {
    const settings = await db.systemSetting.findMany({
      where: { key: { startsWith: 'flag.' } },
    });

    const dbFlags: Partial<FeatureFlags> = {};
    const dbOverrides: Record<string, string> = {};
    for (const s of settings) {
      const flagKey = s.key.replace('flag.', '');
      if (flagKey in defaultFlags) {
        const typed = flagKey as keyof FeatureFlags;
        dbOverrides[flagKey] = s.value;
        if (typeof defaultFlags[typed] === 'boolean') {
          (dbFlags as Record<string, unknown>)[typed] = s.value === 'true';
        } else {
          (dbFlags as Record<string, unknown>)[typed] = parseInt(s.value);
        }
      }
    }
    return { dbFlags, dbOverrides };
  } catch {
    return { dbFlags: {}, dbOverrides: {} };
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
      const { dbFlags, dbOverrides } = await loadDbFlags();

      cachedFlags = {
        ...defaultFlags,
        ...dbFlags,
      };
      cachedDbOverrides = dbOverrides;
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

/**
 * The persisted valueType for a flag key, derived from its runtime type.
 * Matches exactly what updateFeatureFlag writes to the DB, so callers (e.g.
 * the audit trail) can report the stored type rather than the payload's
 * `typeof` (which would say 'string' for a NUMBER flag sent as "50").
 */
export function getFlagValueType(key: string): 'BOOLEAN' | 'NUMBER' {
  const flagKey = key as keyof FeatureFlags;
  return typeof defaultFlags[flagKey] === 'boolean' ? 'BOOLEAN' : 'NUMBER';
}

export async function getMaxUploadSize(): Promise<number> {
  const flags = await getFeatureFlags();
  return flags.maxUploadSizeMb * 1024 * 1024;
}

export async function updateFeatureFlag(key: string, value: string): Promise<boolean> {
  try {
    const dbKey = `flag.${key}`;
    // P0-4 (2026-08-05 ops audit): valueType was hardcoded 'BOOLEAN', so
    // maxUploadSizeMb (a NUMBER flag) was persisted as a boolean — the DB
    // lied about the type and any migration/query bucketing by valueType
    // would have corrupted numeric flags. Derive it from the flag's runtime
    // type so the read path (typeof check) and the stored metadata agree.
    const valueType = getFlagValueType(key);
    await db.systemSetting.upsert({
      where: { key: dbKey },
      update: { value, valueType, category: 'FEATURE', isSecret: false, isEditable: true },
      create: { key: dbKey, value, valueType, category: 'FEATURE', isSecret: false, isEditable: true },
    });

    cachedFlags = null;
    cachedDbOverrides = null;
    cacheExpiry = 0;

    logger.info(`[FeatureFlags] Updated flag: ${key} = ${value}`);
    return true;
  } catch (err) {
    logger.error(`[FeatureFlags] Failed to update flag ${key}:`, err);
    return false;
  }
}

export async function getAllFeatureFlags(): Promise<
  Record<string, { value: string; source: string; valueType: 'BOOLEAN' | 'NUMBER' }>
> {
  const flags = await getFeatureFlags();
  const result: Record<string, { value: string; source: string; valueType: 'BOOLEAN' | 'NUMBER' }> = {};

  for (const [key, value] of Object.entries(flags)) {
    result[key] = {
      value: String(value),
      source: 'runtime',
      valueType: getFlagValueType(key),
    };
  }

  // P2-21: no second query — the DB overrides came back with the same
  // findMany that built `flags`. (If the cache was cold and the DB query
  // failed, cachedDbOverrides is an empty map and everything reports
  // 'runtime' — same behavior as the old catch-and-ignore.)
  if (cachedDbOverrides) {
    for (const [flagKey, rawValue] of Object.entries(cachedDbOverrides)) {
      if (result[flagKey]) {
        result[flagKey].source = 'database';
        result[flagKey].value = rawValue;
      }
    }
  }

  return result;
}
