import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable strict mode to prevent double rendering in dev
  
  // Disable static optimization - app requires dynamic rendering
  // Pages use useSearchParams and server-side features
  output: undefined, // Ensure no static export
  
  // Suppress HMR version.json 404 warnings in dev
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  transpilePackages: ['@chroma-core/default-embed'],
};

export default nextConfig;