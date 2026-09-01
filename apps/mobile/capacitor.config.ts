import type { CapacitorConfig } from '@capacitor/cli';

// appId/appName are provisional until the public identity gate is approved.
// They are local project values only; no Apple identifier has been registered.
const config: CapacitorConfig = {
  appId: 'dev.adrez.aha',
  appName: 'AHA',
  webDir: '../web/build-mobile',
  backgroundColor: '#4A1FD6',
  loggingBehavior: 'debug',
  ios: {
    backgroundColor: '#4A1FD6',
    contentInset: 'never'
  }
};

export default config;
