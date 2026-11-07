import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Auto Poster Driver',
  slug: 'auto-poster-driver',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'autoposter',
  newArchEnabled: true,
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: process.env.IOS_BUNDLE_ID || 'com.autoposter.driver',
    infoPlist: {
      NSCameraUsageDescription:
        'Allow Auto Poster to take installation and daily proof photos of your auto-rickshaw.',
      NSLocationWhenInUseUsageDescription:
        'Auto Poster needs your precise location only when capturing proof photos to verify advertising area.',
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE || 'com.autoposter.driver',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-router',
    'expo-asset',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/NotoSansDevanagari-Regular.ttf',
          './assets/fonts/NotoSansDevanagari-Bold.ttf',
          './assets/fonts/NotoSansGujarati-Regular.ttf',
          './assets/fonts/NotoSansGujarati-Bold.ttf',
        ],
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Allow Auto Poster to take installation and daily proof photos of your auto-rickshaw.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Auto Poster needs your precise location only when capturing proof photos to verify advertising area.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#2563EB',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic:
            process.env.EXPO_PUBLIC_ENV === 'development' ||
            !process.env.EXPO_PUBLIC_ENV,
        },
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID || '00000000-0000-0000-0000-000000000000',
    },
  },
});
