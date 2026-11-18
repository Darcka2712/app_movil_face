import { createExpoSecureStorage } from '@face/auth';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { bootstrapSecureStorage } from '../src/config/bootstrap';
import { hydrateDeviceKey, injectStorage } from '../src/config/client';
import { AppProviders } from '../src/providers/AppProviders';
import { getKioskSyncRuntime } from '../src/modules/attendance/services/syncRuntime';

export default function RootLayout() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await bootstrapSecureStorage(
        {
          createStorage: createExpoSecureStorage,
          inject: injectStorage,
          hydrate: hydrateDeviceKey,
        },
        () => cancelled,
      );
      if (cancelled) return;
      const runtime = await getKioskSyncRuntime();
      if (cancelled) return;
      await runtime.syncNow();
    })().catch(() => {
      // boot sync is best-effort; failures stay queued for next attempt
    });
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
