declare module "next-pwa" {
  import { NextConfig } from "next";

  type PWAOptions = {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    runtimeCaching?: any[];
    buildExcludes?: string[];
  };

  export default function withPWA(options?: PWAOptions): (nextConfig: NextConfig) => NextConfig;
}
