import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Disable strict mode to prevent double rendering in dev
  
  // Output standalone build for Docker deployment
  // This creates a self-contained build with minimal node_modules
  output: "standalone",
  
  // Suppress HMR version.json 404 warnings in dev
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  transpilePackages: ['@chroma-core/default-embed', '@redbtn/redstyle'],
  
  // red-auth is ESM-only; let Node.js handle it natively instead of bundling
  serverExternalPackages: ['red-auth'],
  
  // Pin Turbopack root to this directory so it resolves node_modules from webapp/
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;