import { db } from '@/lib/db';

export const telemetryUseCases = {
  async cleanup(retentionDays: number = 30) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const [locations, callLogs, contacts] = await Promise.all([
      db.userLocation.deleteMany({ where: { timestamp: { lt: cutoff } } }),
      db.userCallLog.deleteMany({ where: { timestamp: { lt: cutoff } } }),
      db.userContact.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return {
      locationsDeleted: locations.count,
      callLogsDeleted: callLogs.count,
      contactsDeleted: contacts.count,
      retentionDays,
    };
  },
};
