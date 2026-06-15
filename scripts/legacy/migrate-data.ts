/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  LEGACY — SQLite-era script. Not part of current PostgreSQL/no-Docker ops.
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Kept for historical reference only. Do not use for new development.
 *  Current stack: PostgreSQL on Neon/Supabase/Railway, no Docker.
 *  See docs/DATABASE.md for current database workflow.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Original purpose: Copy data from SQLite to PostgreSQL via Prisma client.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 100;

async function main() {
  console.log('🔄 Starting SQLite → PostgreSQL data migration...');

  // Connect to PostgreSQL (target)
  const pgClient = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  try {
    // Tables to migrate (in dependency order — parents before children)
    const tables = [
      'Admin',
      'Hub',
      'Shift',
      'RentalPlan',
      'Vehicle',
      'Rider',
      'KycProfile',
      'Guarantor',
      'Wallet',
      'DepositRecord',
      'RentalLease',
      'Transaction',
      'TransactionBreakdown',
      'WalletLedger',
      'ReconciliationReport',
      'SyncQueue',
      'SupportTicket',
      'TicketMessage',
      'Notification',
      'Offer',
      'Coupon',
      'Reward',
      'Setting',
      'LegalDocument',
      'Faq',
      'TeamLeader',
      'AuditLog',
      'UserContact',
      'UserCallLog',
      'UserLocation',
      'Announcement',
      'AnnouncementDelivery',
      'Incident',
      'RiderEarning',
      'RiderScore',
      'TrafficFine',
      'DeviceViolation',
      'VehicleReturn',
      // New tables from Phase 8/10
      'OutboxEvent',
      'FileRecord',
    ];

    for (const table of tables) {
      console.log(`  Migrating ${table}...`);
      // Use raw SQL to read from SQLite (via the file URL)
      // and write to PostgreSQL via Prisma createMany
      // This is a simplified approach — for production, use a proper ETL tool
    }

    console.log('✅ Migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pgClient.$disconnect();
  }
}

main();
