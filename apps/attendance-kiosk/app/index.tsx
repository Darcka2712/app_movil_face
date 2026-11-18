import { Text, View, StyleSheet } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getEnv } from '../src/config/env';
import {
  getDeviceKeyProvisioned,
  subscribeDeviceKey,
  whenDeviceKeyReady,
} from '../src/config/client';
import { getKioskSyncRuntime } from '../src/modules/attendance/services/syncRuntime';

export default function Home() {
  const env = getEnv();
  const provisioned = useSyncExternalStore(
    subscribeDeviceKey,
    getDeviceKeyProvisioned,
    () => false,
  );
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await whenDeviceKeyReady();
      const runtime = await getKioskSyncRuntime();
      const refresh = async () => {
        const count = await runtime.getPendingCount();
        if (!cancelled) setPendingCount(count);
      };
      await refresh();
      await runtime.syncNow();
      await refresh();
    })().catch(() => {
      // pending count is informational only
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACE Attendance</Text>
      <Text testID="env-label">{env.environment}</Text>
      <Text testID="device-key-status">
        {provisioned ? 'device key provisioned' : 'device key pending'}
      </Text>
      <Text testID="pending-count">
        pending sync: {pendingCount === null ? '…' : pendingCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
