import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

// ✅ Initialize PWA plugin
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
});

// ✅ Your normal Next.js config
const baseConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/avatars/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
};

// ✅ Export the wrapped config (PWA + your options)
export default withPWA(baseConfig);
