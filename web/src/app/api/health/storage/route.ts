import { NextResponse } from 'next/server';

export async function GET() {
  const start = Date.now();

  try {
    // Verify the uploads directory is accessible
    const { access } = await import('fs/promises');
    const { join } = await import('path');
    const uploadsDir = process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');

    try {
      await access(uploadsDir);
    } catch {
      // Directory may not exist yet — that's OK, it gets created on first upload
    }

    return NextResponse.json({
      status: 'healthy',
      provider: 'local',
      storageRoot: uploadsDir,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
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
