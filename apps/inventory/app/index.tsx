import { Text, View, StyleSheet } from 'react-native';
import { getEnv } from '../src/config/env';

export default function Home() {
  const env = getEnv();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FACE Inventory</Text>
      <Text testID="env-label">{env.environment}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
