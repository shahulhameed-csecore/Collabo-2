import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure trailing slash behavior is consistent
  trailingSlash: false,
  // Disable x-powered-by header
  poweredByHeader: false,
};

export default nextConfig;
