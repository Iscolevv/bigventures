import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useFocusEffect, router, Link } from 'expo-router';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { startTrailTracking, stopTrailTracking } from '@/lib/location';

const DROP_LABEL: Record<string, string> = {
  pending: 'Pending', arrived: 'Arrived', delivered: 'Delivered', partial: 'Partial', failed: 'Failed', returned: 'Returned',
};

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Record<string, unknown> | null>(null);
  const [drops, setDrops] = useState<Record<string, unknown>[]>([]);
  const [hasCheck, setHasCheck] = useState(false);

  const load = useCallback(() => {
    setTrip(db().getFirstSync('SELECT * FROM trips WHERE client_id = ?', [id]));
    setDrops(db().getAllSync('SELECT * FROM drops WHERE trip_client_id = ? ORDER BY sequence', [id]));
    setHasCheck(!!db().getFirstSync('SELECT 1 FROM vehicle_checks WHERE trip_client_id = ?', [id]));
  }, [id]);
  useFocusEffect(useCallback(() => load(), [load]));

  if (!trip) return <Text style={styles.pad}>Loading…</Text>;
  const status = String(trip.status);
  const allClosed = drops.length > 0 && drops.every((d) => ['delivered', 'partial', 'failed', 'returned'].includes(String(d.status)));

  function setStatus(next: string) {
    db().runSync("UPDATE trips SET status = ?, sync_state = 'dirty', updated_at = ? WHERE client_id = ?", [next, new Date().toISOString(), id]);
    if (next === 'in_progress') {
      db().runSync('UPDATE trips SET started_at = COALESCE(started_at, ?) WHERE client_id = ?', [new Date().toISOString(), id]);
      startTrailTracking(id!).catch(() => {});
    }
    if (next === 'completed') {
      db().runSync('UPDATE trips SET ended_at = COALESCE(ended_at, ?) WHERE client_id = ?', [new Date().toISOString(), id]);
      stopTrailTracking(id!).catch(() => {});
    }
    runSync().catch(() => {});
    load();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>{String(trip.reference_code ?? 'Pending sync')}</Text>
      <Text style={styles.meta}>{String(trip.loading_address)}</Text>
      <Text style={styles.status}>Status: {status.replace('_', ' ')}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Drops ({drops.length})</Text>
        {status !== 'completed' && (
          <Link href={`/(driver)/add-drop/${id}`} asChild>
            <Pressable>
              <Text style={styles.addLink}>+ Add</Text>
            </Pressable>
          </Link>
        )}
      </View>
      {drops.length === 0 && <Text style={styles.meta}>No drops yet — add at least one.</Text>}
      {drops.map((d) => (
        <Pressable key={String(d.client_id)} style={styles.drop} onPress={() => router.push(`/(driver)/drop/${d.client_id}`)}>
          <Text style={styles.dropAddr}>
            {String(d.sequence)}. {String(d.destination_address)}
          </Text>
          <Text style={styles.dropStatus}>{DROP_LABEL[String(d.status)] ?? String(d.status)}</Text>
        </Pressable>
      ))}

      <View style={styles.actions}>
        {status === 'draft' && (
          <Pressable style={styles.btn} onPress={() => router.push(`/(driver)/check/${id}`)}>
            <Text style={styles.btnText}>Start vehicle check</Text>
          </Pressable>
        )}
        {status === 'pre_check' && (
          <>
            {!hasCheck && (
              <Pressable style={styles.btn} onPress={() => router.push(`/(driver)/check/${id}`)}>
                <Text style={styles.btnText}>Complete vehicle check</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.btn, (drops.length === 0 || !hasCheck) && styles.btnDisabled]}
              disabled={drops.length === 0 || !hasCheck}
              onPress={() => setStatus('in_progress')}
            >
              <Text style={styles.btnText}>Start driving</Text>
            </Pressable>
          </>
        )}
        {status === 'in_progress' && (
          <>
            <Pressable style={styles.btnOutline} onPress={() => router.push(`/(driver)/fuel/${id}`)}>
              <Text style={styles.btnOutlineText}>Log fuel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, !allClosed && styles.btnDisabled]}
              disabled={!allClosed}
              onPress={() => setStatus('completed')}
            >
              <Text style={styles.btnText}>{allClosed ? 'Close trip' : 'Close all drops first'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  pad: { padding: 20 },
  h1: { fontSize: 20, fontWeight: '700' },
  meta: { color: '#6b7280', marginTop: 2 },
  status: { marginTop: 8, fontWeight: '600', color: '#1f5f4f' },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 },
  sectionTitle: { fontWeight: '700' },
  addLink: { color: '#1f5f4f', fontWeight: '700' },
  drop: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  dropAddr: { fontWeight: '600', flex: 1 },
  dropStatus: { color: '#6b7280', marginLeft: 8 },
  actions: { marginTop: 26, gap: 10 },
  btn: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: 'white', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: '#1f5f4f', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnOutlineText: { color: '#1f5f4f', fontWeight: '700' },
});
