import { Text, View, StyleSheet } from 'react-native';
import { useSyncExternalStore } from 'react';
import { getEnv } from '../src/config/env';
import { getDeviceKeyProvisioned, subscribeDeviceKey } from '../src/config/client';

export default function Home() {
  const env = getEnv();
  const provisioned = useSyncExternalStore(
    subscribeDeviceKey,
    getDeviceKeyProvisioned,
    () => false,
  );
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACE Attendance</Text>
      <Text testID="env-label">{env.environment}</Text>
      <Text testID="device-key-status">
        {provisioned ? 'device key provisioned' : 'device key pending'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
