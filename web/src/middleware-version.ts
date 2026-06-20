import { NextRequest, NextResponse } from 'next/server';
import { getApiVersion, API_VERSION, isVersionDeprecated } from '@/lib/api-version';
import { errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export function withApiVersion(
  handler: (req: NextRequest, version: string) => Promise<NextResponse>
) {
  return async function versionedHandler(request: NextRequest) {
    const version = getApiVersion(request);

    if (isVersionDeprecated(version)) {
      const response = errors.badRequest(
        `API version ${version} is deprecated. Use ${API_VERSION} or later.`
      );
      response.headers.set('Api-Version', API_VERSION);
      response.headers.set('Deprecation', `version="${version}"`);
      return response;
    }

    try {
      const response = await handler(request, version);
      response.headers.set('Api-Version', version);
      return response;
    } catch (err) {
      logger.error('[VersionMiddleware] Handler threw uncaught error', { error: err });
      const response = errors.internal('An unexpected error occurred');
      response.headers.set('Api-Version', version);
      return response;
    }
  };
}

/**
 * Parse a version string like "v1" or "v2" into its numeric component.
 * Returns 0 for unknown/malformed versions.
 */
function parseVersionNumber(v: string): number {
  const match = v.match(/^v(\d+)$/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function requireVersion(minVersion: string) {
  return function versionGuard(request: NextRequest): NextResponse | null {
    const version = getApiVersion(request);
    const requested =
      request.nextUrl.searchParams.get('api-version') ||
      request.headers.get('api-version') ||
      version;

    const requestedNum = parseVersionNumber(requested);
    const minNum = parseVersionNumber(minVersion);

    if (requestedNum === 0) {
      return errors.badRequest(`Unsupported API version: ${requested}. Supported: v1+`);
    }

    if (requestedNum < minNum) {
      return errors.badRequest(
        `API version ${requested} is below minimum required version ${minVersion}. Upgrade to ${minVersion} or later.`
      );
    }

    return null;
  };
}
