import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      // Allow storage host for rider photos, KYC docs, etc.
      ...(process.env.STORAGE_HOST
        ? [{ protocol: 'https' as const, hostname: process.env.STORAGE_HOST }]
        : []),
      // Allow Firebase storage bucket if configured
      ...(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        ? [
            {
              protocol: 'https' as const,
              hostname: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            } as const,
          ]
        : []),
      // Allow localhost in development for local file serving
      ...(process.env.NODE_ENV === 'development'
        ? [{ protocol: 'http' as const, hostname: 'localhost' }]
        : []),
    ],
  },
  // Security headers are set in middleware.ts — no duplicate static headers here
  // to avoid conflicts with the middleware CSP.
};

export default nextConfig;
