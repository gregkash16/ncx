// next.config.ts (ESM + TypeScript, Next 15)
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { RouteMatchCallbackOptions } from "workbox-core/types.js";

const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Existing Discord avatars
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      // ✅ Add YouTube thumbnails
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
};

export default function defineConfig(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  // ✅ Skip PWA in dev — avoids GenerateSW spam
  if (isDev) return baseConfig;

  // ✅ Only wrap with next-pwa in production
  const runtimeCaching = [
    {
      urlPattern: ({ url }: RouteMatchCallbackOptions) =>
        url.origin === self.location.origin && url.pathname.startsWith("/logos/"),
      handler: "CacheFirst",
      options: {
        cacheName: "ncx-logos",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
  ];

  const withPWA = withPWAInit({
    dest: "public",
    register: true,
    skipWaiting: true,
    runtimeCaching,
  });

  return withPWA(baseConfig);
}
