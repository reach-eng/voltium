import { NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { telemetryUseCases } from '@/server/modules/telemetry/telemetry.use-cases';

export async function GET(req: Request) {
  try {
    const result = await telemetryUseCases.cleanup(30);

    logger.info('[Cleanup Telemetry] Success', {
      locations: result.locationsDeleted,
      callLogs: result.callLogsDeleted,
      contacts: result.contactsDeleted,
    });

    return success(
      {
        locations: result.locationsDeleted,
        callLogs: result.callLogsDeleted,
        contacts: result.contactsDeleted,
      },
      'Telemetry cleanup completed successfully'
    );
  } catch (e) {
    logger.error('[Cleanup Telemetry] Error', e);
    return errors.internal('Telemetry cleanup failed');
  }
}
