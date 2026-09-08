import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { useApp } from '@/store';

interface TripRow {
  client_id: string;
  reference_code: string | null;
  status: string;
  loading_address: string;
  sync_state: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pre_check: 'Vehicle check',
  in_progress: 'On the road',
  completed: 'Completed',
  cancelled: 'Cancelled',
  flagged: 'Needs review',
};

export default function TripList() {
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const lastSyncAt = useApp((s) => s.lastSyncAt);

  const load = useCallback(() => {
    setTrips(
      db().getAllSync<TripRow>(
        'SELECT client_id, reference_code, status, loading_address, sync_state FROM trips ORDER BY updated_at DESC',
      ),
    );
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  async function onRefresh() {
    setRefreshing(true);
    await runSync().catch(() => {});
    load();
    setRefreshing(false);
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.client_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <Text style={styles.sync}>
            {lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Not yet synced'}
          </Text>
        }
        ListEmptyComponent={<Text style={styles.empty}>No trips yet. Tap “Start a trip”.</Text>}
        renderItem={({ item }) => (
          <Link href={`/(driver)/trip/${item.client_id}`} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.ref}>{item.reference_code ?? 'Pending sync'}</Text>
              <Text style={styles.addr}>{item.loading_address}</Text>
              <View style={styles.row}>
                <Text style={styles.badge}>{STATUS_LABEL[item.status] ?? item.status}</Text>
                {item.sync_state !== 'synced' && <Text style={styles.dirty}>● {item.sync_state}</Text>}
              </View>
            </Pressable>
          </Link>
        )}
      />
      <Link href="/(driver)/new-trip" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabText}>Start a trip</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f7f7f6' },
  sync: { padding: 12, color: '#6b7280', fontSize: 12 },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  card: { backgroundColor: 'white', marginHorizontal: 12, marginVertical: 4, padding: 14, borderRadius: 10 },
  ref: { fontWeight: '700' },
  addr: { color: '#374151', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  badge: { fontSize: 12, color: '#1f5f4f', fontWeight: '600' },
  dirty: { fontSize: 12, color: '#b45309' },
  fab: { position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: '#1f5f4f', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999 },
  fabText: { color: 'white', fontWeight: '700' },
});
