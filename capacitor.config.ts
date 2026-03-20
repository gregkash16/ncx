import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.ncx.app',
  appName: 'NCX',
  webDir: isDev ? 'public' : '.next/standalone/public',
  server: isDev
    ? {
        url: 'https://6e211c86e8ca.ngrok.app',
        cleartext: false,
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
