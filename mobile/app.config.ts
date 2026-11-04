import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Auto Poster Driver',
  slug: 'auto-poster-driver',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  scheme: 'autoposter',
  newArchEnabled: true,
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.autoposter.driver',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
    },
    package: 'com.autoposter.driver',
  },
  plugins: ['expo-router'],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    eas: {
      projectId: process.env.EAS_PROJECT_ID || '00000000-0000-0000-0000-000000000000',
    },
  },
});
