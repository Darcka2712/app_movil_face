import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FACE Workforce',
  slug: 'face-workforce',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'faceworkforce',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.facenexus.workforce',
    versionCode: 1,
    permissions: ['CAMERA', 'INTERNET'],
  },
  plugins: ['expo-router'],
  extra: {
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3002/api/v1',
  },
});
