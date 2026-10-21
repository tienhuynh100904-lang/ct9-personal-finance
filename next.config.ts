import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Detects a dropped connection and retries page changes and Server Actions (saving a transaction)
    // made meanwhile once it is back; <OfflineBanner> tells the user.
    useOffline: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // The service worker for push reminders: never cached, so an update reaches the phone.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
