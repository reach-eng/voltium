import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

let isDbOffline = process.env.DATABASE_OFFLINE === 'true';
let recoveryTimer: any = null;

function startRecoveryCheck(client: any) {
  if (recoveryTimer || process.env.DATABASE_OFFLINE !== 'true') return;
  logger.info('[Prisma Auto-Recovery] Database offline detected. Starting connection monitoring...');
  recoveryTimer = setInterval(async () => {
    try {
      await client.$queryRawUnsafe('SELECT 1');
      logger.info('[Prisma Auto-Recovery] Database connection restored. Disabling offline mock fallback.');
      isDbOffline = false;
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
      }
    } catch (e) {
      // Keep trying
    }
  }, 30000);
  if (recoveryTimer && typeof recoveryTimer.unref === 'function') {
    recoveryTimer.unref();
  }
}

const mockRiderPhoneMap = new Map<string, string>();

const EXISTING_PHONES = new Set([
  '9999900001', '+919999900001',
  '9876543210', '+919876543210',
  '9999999999', '+919999999999',
  '8888888888', '+918888888888',
  '7788888801', '+917788888801'
]);

const EXISTING_IDS = new Set([
  'mock-rider-db-id',
  'rider-1',
  'rider-dev-id'
]);

function getMockFallback(operation: string, model?: string, args?: any) {
  if (operation === 'count') return 0;
  if (operation === 'findMany') return [];
  
  if (operation === 'create' && model === 'Rider') {
    const id = args?.data?.id || args?.data?.riderId || `mock-rider-${Date.now()}`;
    const phone = args?.data?.phone || '9999900001';
    mockRiderPhoneMap.set(id, phone);
  }

  if (operation === 'findFirst' || operation === 'findUnique') {
    if (model === 'Rider') {
      const id = args?.where?.id;
      const phone = args?.where?.phone;
      
      const isExisting = 
        (phone && EXISTING_PHONES.has(phone)) ||
        (id && EXISTING_IDS.has(id)) ||
        (id && mockRiderPhoneMap.has(id)) ||
        (phone && Array.from(mockRiderPhoneMap.values()).includes(phone));
        
      if (!isExisting) {
        return null;
      }
      
      const resolvedPhone = phone || (id ? mockRiderPhoneMap.get(id) : undefined) || '9999900001';
      const resolvedId = id || 'mock-rider-db-id';
      
      if (resolvedId && resolvedPhone) {
        mockRiderPhoneMap.set(resolvedId, resolvedPhone);
      }
      
      return {
        id: resolvedId,
        riderId: 'VF-RD-MOCK',
        phone: resolvedPhone,
        fullName: 'Mock Rider',
        lifecycleStatus: 'PROFILE_SUBMITTED',
        registrationDoneAt: new Date(),
        referralCode: 'MOCK-CODE',
        referredBy: null,
        deletedAt: null,
        kycProfile: {
          id: 'mock-kyc-id',
          status: 'APPROVED',
        },
        wallet: {
          id: 'mock-wallet-id',
          balanceInPaise: 100000,
          securityDeposit: 500000,
          depositStatus: 'APPROVED',
        },
        guarantor: null,
        vehicleReturns: [],
      };
    }
    if (model === 'Wallet') {
      return {
        id: 'mock-wallet-id',
        riderId: args?.where?.riderId || args?.where?.id || 'mock-rider-db-id',
        balanceInPaise: 100000,
        securityDeposit: 500000,
        depositStatus: 'APPROVED',
        paymentStreak: 0,
        version: 1,
      };
    }
    if (model === 'KycProfile') {
      return {
        id: 'mock-kyc-id',
        riderId: args?.where?.riderId || args?.where?.id || 'mock-rider-db-id',
        status: 'APPROVED',
      };
    }
    if (model === 'Guarantor') {
      return {
        id: 'mock-guarantor-id',
        riderId: args?.where?.riderId || args?.where?.id || 'mock-rider-db-id',
        status: 'APPROVED',
      };
    }
    return null;
  }

  if (operation === 'aggregate') {
    return {
      _sum: { balanceInPaise: 0, securityDeposit: 0 },
      _avg: {},
      _count: 0,
      _min: {},
      _max: {},
    };
  }
  
  if (operation === 'create' || operation === 'update' || operation === 'upsert') {
    const id = args?.data?.id || args?.data?.riderId || 'mock-id';
    return { id, ...args?.data };
  }
  
  return null;
}

const createPrismaClient = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const showQueries = process.env.DEBUG_SQL === 'true';

  let dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgresql') || dbUrl.startsWith('postgres'))) {
    try {
      const url = new URL(dbUrl);
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', process.env.DATABASE_POOL_SIZE || '10');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT || '30');
      }
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', isDev ? '2' : '10');
      }
      dbUrl = url.toString();
      logger.info('PostgreSQL pool config applied dynamically', {
        connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
        poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
        connectTimeout: isDev ? '2' : '10',
      });
    } catch (e) {
      logger.warn('Failed to parse DATABASE_URL for dynamic pool configuration', { error: e });
    }
  }

  const client = new PrismaClient({
    log: isDev ? (showQueries ? ['query', 'error', 'warn'] : ['error', 'warn']) : ['error'],
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
  });

  const prisma = client.$extends({
    query: {
      async $queryRaw({ args, query }) {
        if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
          return [];
        }
        try {
          return await query(args);
        } catch (err: any) {
          if (process.env.DATABASE_OFFLINE === 'true') {
            isDbOffline = true;
            startRecoveryCheck(client);
            logger.warn('[Prisma Offline Bypass] queryRaw failed, short-circuiting DB queries:', err.message);
            return [];
          }
          throw err;
        }
      },
      async $executeRaw({ args, query }) {
        if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
          return 0;
        }
        try {
          return await query(args);
        } catch (err: any) {
          if (process.env.DATABASE_OFFLINE === 'true') {
            isDbOffline = true;
            startRecoveryCheck(client);
            logger.warn('[Prisma Offline Bypass] executeRaw failed, short-circuiting DB queries:', err.message);
            return 0;
          }
          throw err;
        }
      },
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: any; query: (args: any) => Promise<any> }): Promise<any> {
          if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
            return getMockFallback(operation, model, args);
          }

          const softDeleteModels = ['Rider', 'Vehicle', 'RentalPlan', 'Shift', 'Guarantor', 'SupportTicket'];
          if (softDeleteModels.includes(model)) {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            if (operation === 'delete') {
              try {
                return await (client as any)[modelKey].update({
                  where: args.where,
                  data: { deletedAt: new Date() },
                });
              } catch (err: any) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(`[Prisma Offline Bypass] DB down. Soft-delete on ${model} failed: ${err.message}`);
                  return getMockFallback(operation, model, args);
                }
                throw err;
              }
            }
            if (operation === 'deleteMany') {
              try {
                return await (client as any)[modelKey].updateMany({
                  where: args.where || {},
                  data: { deletedAt: new Date() },
                });
              } catch (err: any) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(`[Prisma Offline Bypass] DB down. Soft-deleteMany on ${model} failed: ${err.message}`);
                  return getMockFallback(operation, model, args);
                }
                throw err;
              }
            }
            if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
            if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              const newOp = operation === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
              args.where = { ...args.where, deletedAt: null };
              try {
                return await (client as any)[modelKey][newOp](args);
              } catch (err: any) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(`[Prisma Offline Bypass] DB down. findUnique fallback on ${model} failed: ${err.message}`);
                  return getMockFallback(operation, model, args);
                }
                throw err;
              }
            }
            if (['update', 'updateMany', 'upsert'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
          }

          try {
            return await query(args);
          } catch (err: any) {
            if (process.env.DATABASE_OFFLINE === 'true') {
              isDbOffline = true;
              startRecoveryCheck(client);
              logger.warn(`[Prisma Offline Bypass] DB down. Fallback for ${operation} on ${model}: ${err.message}`);
              return getMockFallback(operation, model, args);
            }
            throw err;
          }
        },
      },
    },
  });

  return prisma;
};

const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export { db };

export async function gracefulShutdown() {
  if (db && typeof db.$disconnect === 'function') {
    await db.$disconnect();
  }
  logger.info('Prisma connection pool disconnected');
}

export function getPoolStats() {
  return {
    connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
    poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
    idleTimeout: process.env.DATABASE_IDLE_TIMEOUT || '60',
  };
}
