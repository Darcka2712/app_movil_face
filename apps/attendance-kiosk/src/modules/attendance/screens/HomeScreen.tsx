import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  getDeviceKeyProvisioned,
  subscribeDeviceKey,
  whenDeviceKeyReady,
} from '../../../config/client';
import { getEnv } from '../../../config/env';
import { getKioskAttendanceRuntime } from '../services/attendanceRuntime';
import { resultMessage, successMessage } from '../services/resultMessages';
import { getKioskSyncRuntime } from '../services/syncRuntime';

type ResultState =
  | { kind: 'success'; text: string }
  | { kind: 'error'; text: string }
  | null;

const ENQUEUE_FALLBACK = 'No se pudo guardar — intente de nuevo';

export default function HomeScreen() {
  const env = getEnv();
  const provisioned = useSyncExternalStore(
    subscribeDeviceKey,
    getDeviceKeyProvisioned,
    () => false,
  );
  const [codigo, setCodigo] = useState('');
  const [result, setResult] = useState<ResultState>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const refreshPending = async () => {
    try {
      const sync = await getKioskSyncRuntime();
      setPendingCount(await sync.getPendingCount());
    } catch {
      // informational only
    }
  };

  const onSubmit = async () => {
    if (submitting || !codigo.trim()) return;
    setSubmitting(true);
    try {
      const runtime = await getKioskAttendanceRuntime();
      const outcome = await runtime.record(codigo);
      if (outcome.ok) {
        setResult({ kind: 'success', text: successMessage(outcome.eventType) });
        setCodigo('');
        void refreshPending();
      } else {
        setResult({ kind: 'error', text: resultMessage(outcome.code) });
      }
    } catch {
      setResult({ kind: 'error', text: ENQUEUE_FALLBACK });
    } finally {
      setSubmitting(false);
    }
  };

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

      <TextInput
        testID="codigo-input"
        style={styles.input}
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="characters"
        placeholder="Codigo"
        autoCorrect={false}
        onSubmitEditing={() => void onSubmit()}
        returnKeyType="done"
      />
      <Button
        testID="submit"
        title="Registrar"
        onPress={() => void onSubmit()}
        disabled={submitting}
      />

      {result?.kind === 'success' && (
        <Text testID="result-success" style={styles.success}>
          {result.text}
        </Text>
      )}
      {result?.kind === 'error' && (
        <Text testID="result-error" style={styles.error}>
          {result.text}
        </Text>
      )}

      <View style={styles.statusRow}>
        <Button testID="status-link" title="Estado" onPress={() => router.push('/status')} />
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
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  success: { color: '#1a7f37', fontSize: 16 },
  error: { color: '#c1121f', fontSize: 16 },
  statusRow: { marginTop: 16 },
});
