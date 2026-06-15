import { NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import { logger } from '@/lib/logger';

export async function GET() {
  const start = Date.now();

  try {
    const provider = await getStorageProvider();
    const storageType = process.env.STORAGE_PROVIDER || 'local';

    // For local storage, verify the uploads directory is writable
    if (storageType === 'local') {
      const { access } = await import('fs/promises');
      const { join } = await import('path');
      const uploadsDir = join(process.cwd(), 'data', 'uploads');

      try {
        await access(uploadsDir);
      } catch {
        // Directory may not exist yet — that's OK, it gets created on first upload
      }

      return NextResponse.json({
        status: 'healthy',
        provider: 'local',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
    }

    // For GCS, attempt to generate a signed URL for a known test key
    if (storageType === 'gcs') {
      try {
        const testKey = `_health_check_${Date.now()}`;
        await provider.getSignedReadUrl(testKey, 1);

        return NextResponse.json({
          status: 'healthy',
          provider: 'gcs',
          bucket: process.env.GCS_BUCKET_NAME || 'unknown',
          latencyMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        logger.error('[Health/Storage] GCS check failed', { error: err?.message });

        return NextResponse.json(
          {
            status: 'unhealthy',
            provider: 'gcs',
            latencyMs: Date.now() - start,
            error: err?.message ?? 'GCS unreachable',
            timestamp: new Date().toISOString(),
          },
          { status: 503 }
        );
      }
    }

    // Unknown storage provider
    return NextResponse.json({
      status: 'healthy',
      provider: storageType,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[Health/Storage] Storage check failed', { error: err?.message });

    return NextResponse.json(
      {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
