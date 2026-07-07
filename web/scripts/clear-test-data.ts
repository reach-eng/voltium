import { db } from '../src/lib/db';

async function main() {
  console.log('Clearing mock and testing data...');
  const tableNames = [
    'Rider', 'KycProfile', 'Guarantor', 'Wallet', 'WalletLedger',
    'DepositRecord', 'RentalLease', 'Transaction', 'TransactionBreakdown',
    'SupportTicket', 'TicketMessage', 'Notification', 'NotificationDelivery',
    'AuditLog', 'SyncQueue', 'FileRecord', 'Incident', 'RiderEarning',
    'RiderScore', 'TrafficFine', 'DeviceViolation', 'UserContact',
    'UserCallLog', 'UserLocation', 'OtpCode', 'OutboxEvent', 'ReconciliationReport', 'VehicleReturn',
    'Shift', 'Vehicle', 'team_leaders', 'Hub'
  ];

  try {
    const tablesStr = tableNames.map(t => `"${t}"`).join(', ');
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tablesStr} CASCADE;`);
    console.log(`Successfully truncated ${tableNames.length} tables.`);
  } catch (e) {
    console.error(`Failed to truncate tables:`, e);
  }

  console.log('Mock data cleared.');
}

main().catch(console.error).finally(() => db.$disconnect());
