import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Explicitly forward the API URL to the browser bundle.
    // This ensures the variable is embedded at build time even if
    // the Vercel project env var is missing; the hard-coded fallback
    // in lib/api.ts will still kick in as a second safety net.
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "https://collabo-2.onrender.com",
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
