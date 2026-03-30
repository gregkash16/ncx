import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ncx.app',
  appName: 'NCX',
  webDir: 'public',
  server: {
    url: 'https://nickelcityxwing.com',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
