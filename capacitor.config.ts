import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.michaelvogt.kfzsammler',
  appName: 'KFZ-Sammler',

  // Muss zum Ergebnis von `ng build` passen – siehe ls oben.
  webDir: 'dist/kfz-sammler/browser',

  android: {
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#003399',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#003399',
    },
  },
};

export default config;
