import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { startTrailTracking, stopTrailTracking } from '@/lib/location';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [drops, setDrops] = useState<any[]>([]);

  const load = useCallback(() => {
    setTrip(db().getFirstSync('SELECT * FROM trips WHERE client_id = ?', [id]));
    setDrops(db().getAllSync('SELECT * FROM drops WHERE trip_client_id = ? ORDER BY sequence', [id]));
  }, [id]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!trip) return <Text style={styles.pad}>Loading…</Text>;

  function setStatus(status: string) {
    db().runSync("UPDATE trips SET status = ?, sync_state = 'dirty', updated_at = ? WHERE client_id = ?", [status, new Date().toISOString(), id]);
    if (status === 'in_progress') {
      db().runSync("UPDATE trips SET started_at = COALESCE(started_at, ?) WHERE client_id = ?", [new Date().toISOString(), id]);
      startTrailTracking(id!).catch(() => {});
    }
    if (status === 'completed') {
      db().runSync("UPDATE trips SET ended_at = COALESCE(ended_at, ?) WHERE client_id = ?", [new Date().toISOString(), id]);
      stopTrailTracking(id!).catch(() => {});
    }
    runSync().catch(() => {});
    load();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>{trip.reference_code ?? 'Pending sync'}</Text>
      <Text style={styles.meta}>{trip.loading_address}</Text>
      <Text style={styles.status}>Status: {trip.status}</Text>

      <Text style={styles.section}>Drops ({drops.length})</Text>
      {drops.length === 0 && <Text style={styles.meta}>No drops added yet.</Text>}
      {drops.map((d) => (
        <View key={d.client_id} style={styles.drop}>
          <Text style={styles.dropAddr}>
            {d.sequence}. {d.destination_address}
          </Text>
          <Text style={styles.meta}>{d.status}</Text>
        </View>
      ))}

      <View style={styles.actions}>
        {(trip.status === 'draft' || trip.status === 'pre_check') && (
          <Pressable style={styles.btn} onPress={() => router.push(`/(driver)/check/${id}`)}>
            <Text style={styles.btnText}>
              {trip.status === 'draft' ? 'Start vehicle check' : 'Redo vehicle check'}
            </Text>
          </Pressable>
        )}
        {trip.status === 'pre_check' && (
          <Pressable style={styles.btn} onPress={() => setStatus('in_progress')}>
            <Text style={styles.btnText}>Start driving</Text>
          </Pressable>
        )}
        {trip.status === 'in_progress' && (
          <Pressable style={styles.btn} onPress={() => setStatus('completed')}>
            <Text style={styles.btnText}>Close trip</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20 },
  pad: { padding: 20 },
  h1: { fontSize: 20, fontWeight: '700' },
  meta: { color: '#6b7280', marginTop: 2 },
  status: { marginTop: 8, fontWeight: '600', color: '#1f5f4f' },
  section: { marginTop: 20, fontWeight: '700' },
  drop: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginTop: 8 },
  dropAddr: { fontWeight: '600' },
  actions: { marginTop: 24, gap: 8 },
  btn: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
});
