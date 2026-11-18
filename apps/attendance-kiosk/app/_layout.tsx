import { createExpoSecureStorage } from '@face/auth';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { hydrateDeviceKey, injectStorage } from '../src/config/client';
import { AppProviders } from '../src/providers/AppProviders';

export default function RootLayout() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storage = await createExpoSecureStorage();
        if (cancelled) return;
        injectStorage(storage);
        await hydrateDeviceKey();
      } catch {
        // SecureStore unavailable: getCredentials() keeps MemorySecureStorage fallback
      }
    })();
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
