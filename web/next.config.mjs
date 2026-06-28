/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      ...(process.env.STORAGE_HOST
        ? [{ protocol: 'https', hostname: process.env.STORAGE_HOST }]
        : []),
      ...(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        ? [{ protocol: 'https', hostname: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }]
        : []),
      ...(process.env.NODE_ENV === 'development'
        ? [{ protocol: 'http', hostname: 'localhost' }]
        : []),
    ],
  },
};

export default nextConfig;
