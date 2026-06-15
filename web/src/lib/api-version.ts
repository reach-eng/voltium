import { NextRequest } from 'next/server';

export const API_VERSION = 'v1';

export const SUPPORTED_VERSIONS = ['v1'] as const;
export type SupportedVersion = (typeof SUPPORTED_VERSIONS)[number];

export function getApiVersion(req: NextRequest): SupportedVersion {
  const acceptHeader = req.headers.get('accept') || '';
  const acceptMatch = acceptHeader.match(/api-version=([a-z0-9]+)/i);
  if (acceptMatch) {
    const version = acceptMatch[1] as SupportedVersion;
    if (SUPPORTED_VERSIONS.includes(version)) return version;
  }

  const queryVersion = req.nextUrl.searchParams.get('api-version');
  if (queryVersion && SUPPORTED_VERSIONS.includes(queryVersion as SupportedVersion)) {
    return queryVersion as SupportedVersion;
  }

  const urlPath = req.nextUrl.pathname;
  const pathMatch = urlPath.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1] as SupportedVersion;
    if (SUPPORTED_VERSIONS.includes(version)) return version;
  }

  return API_VERSION;
}

export function negotiateVersion(requestedVersion: string): SupportedVersion | null {
  if (SUPPORTED_VERSIONS.includes(requestedVersion as SupportedVersion)) {
    return requestedVersion as SupportedVersion;
  }
  return null;
}

export function getVersionedPath(path: string, version: SupportedVersion = API_VERSION): string {
  if (path.startsWith(`/api/${version}/`)) return path;
  if (path.startsWith('/api/')) {
    return path.replace('/api/', `/api/${version}/`);
  }
  return `/api/${version}${path}`;
}

export function isVersionDeprecated(version: SupportedVersion): boolean {
  const deprecated: SupportedVersion[] = [];
  return deprecated.includes(version);
}
