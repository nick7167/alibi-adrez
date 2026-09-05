import type { CapacitorConfig } from '@capacitor/cli';

// Public name approved by the owner. Keep the existing technical identifier;
// no Apple identifier has been registered yet and release clearance is separate.
const config: CapacitorConfig = {
  appId: 'dev.adrez.aha',
  appName: 'Hvem mon?',
  webDir: '../web/build-mobile',
  backgroundColor: '#4A1FD6',
  loggingBehavior: 'debug',
  ios: {
    backgroundColor: '#4A1FD6',
    contentInset: 'never'
  }
};

export default config;
