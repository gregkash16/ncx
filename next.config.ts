// next.config.ts (ESM + TypeScript, Next 15)
import type { NextConfig } from "next";
import withPWAInit from "next-pwa";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
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
  if (isDev) return baseConfig; // no PWA in dev

  const runtimeCaching = [
    {
      // use a simple RegExp to avoid type funkiness
      urlPattern: /^\/logos\//,
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

    // ⛔ prevent Workbox from precaching Next internal manifests that 404 in prod
    buildExcludes: [
      "**/app-build-manifest.json",
      "**/react-loadable-manifest.json",
      "**/middleware-manifest.json",
      "**/_buildManifest.js",
      "**/_ssgManifest.js",
    ],
  });

  return withPWA(baseConfig);
}
