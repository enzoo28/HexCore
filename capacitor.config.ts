import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hexcorelabs.re',
  appName: 'HexCore Labs',
  webDir: 'frontend',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0a0f',
    preferredContentMode: 'mobile'
  }
};

export default config;
