import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken, signIn } from '@/lib/auth';
import { useApp } from '@/store';

export default function Gate() {
  const session = useApp((s) => s.session);
  const setSession = useApp((s) => s.setSession);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((t) => {
      if (t && !session) setSession({ userId: 'restored', name: 'Driver' });
      setChecking(false);
    });
  }, [session, setSession]);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (session) return <Redirect href="/(driver)" />;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const s = await signIn(email.trim(), password);
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Big Ventures</Text>
      <Text style={styles.sub}>Driver app</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#6b7280', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c' },
});
