import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { migrate, getMeta } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { getToken } from '@/lib/auth';
import { useApp } from '@/store';

export default function RootLayout() {
  const setLastSyncAt = useApp((s) => s.setLastSyncAt);
  const migrated = useRef(false);

  if (!migrated.current) {
    migrate();
    migrated.current = true;
  }

  useEffect(() => {
    let mounted = true;
    async function tick() {
      if (!(await getToken())) return;
      await runSync().catch(() => {});
      const at = getMeta('lastSyncAt');
      if (mounted && at) setLastSyncAt(at);
    }
    tick();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    const timer = setInterval(tick, 30_000);
    return () => {
      mounted = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [setLastSyncAt]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
