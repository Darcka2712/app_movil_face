import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { getKioskSyncRuntime } from '../services/syncRuntime';
import type { StatusSummary } from '../services/statusSummary';

export default function StatusScreen() {
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    try {
      const sync = await getKioskSyncRuntime();
      setSummary(await sync.getStatusSummary());
    } catch {
      // counters are informational; keep last known values
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const sync = await getKioskSyncRuntime();
      await sync.syncNow();
      await refresh();
    } catch {
      // keep last known summary
    } finally {
      setSyncing(false);
    }
  };

  const rejected = summary?.rejected ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Estado de sincronización</Text>

      <Text testID="count-pending" style={styles.count}>
        Pendientes: {summary === null ? '…' : summary.pending}
      </Text>
      <Text testID="count-synced" style={styles.count}>
        Sincronizados: {summary === null ? '…' : summary.synced}
      </Text>
      <Text
        testID="count-rejected"
        style={rejected > 0 ? styles.rejectedProminent : styles.count}
      >
        Requiere revisión: {summary === null ? '…' : summary.rejected}
      </Text>

      <View style={styles.actions}>
        <Button
          testID="sync-now"
          title="Sincronizar ahora"
          onPress={() => void onSync()}
          disabled={syncing}
        />
        <Button testID="back" title="Volver" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '600' },
  count: { fontSize: 18 },
  rejectedProminent: { fontSize: 18, fontWeight: '700', color: '#c1121f' },
  actions: { marginTop: 16, gap: 8 },
});
