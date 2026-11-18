import { createExpoSecureStorage } from '@face/auth';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { bootstrapSecureStorage } from '../src/config/bootstrap';
import { hydrateDeviceKey, injectStorage } from '../src/config/client';
import { AppProviders } from '../src/providers/AppProviders';

export default function RootLayout() {
  useEffect(() => {
    let cancelled = false;
    void bootstrapSecureStorage(
      {
        createStorage: createExpoSecureStorage,
        inject: injectStorage,
        hydrate: hydrateDeviceKey,
      },
      () => cancelled,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppProviders>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
