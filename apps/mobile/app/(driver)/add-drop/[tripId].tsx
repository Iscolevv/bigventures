import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';

export default function AddDrop() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [pinned, setPinned] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const nextSeq =
    (db().getFirstSync<{ n: number }>('SELECT COALESCE(MAX(sequence),0) AS n FROM drops WHERE trip_client_id = ?', [tripId])?.n ?? 0) + 1;

  async function pinHere() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Location permission needed');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPinned({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      Alert.alert('Could not get location', e instanceof Error ? e.message : 'try again');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!address) {
      Alert.alert('Address required', 'Enter the delivery address.');
      return;
    }
    const id = Crypto.randomUUID();
    db().runSync(
      `INSERT INTO drops (client_id, trip_client_id, sequence, destination_address, dest_lat, dest_lng, status, notes, sync_state, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'dirty', ?)`,
      [id, tripId!, nextSeq, address.trim(), pinned?.lat ?? null, pinned?.lng ?? null, note || null, new Date().toISOString()],
    );
    runSync().catch(() => {});
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Add drop #{nextSeq}</Text>

      <Text style={styles.label}>Delivery address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Shop / customer / area" />

      <Text style={styles.label}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Contact, gate instructions…" />

      <Pressable style={styles.pinBtn} onPress={pinHere} disabled={busy}>
        <Text style={styles.pinBtnText}>
          {pinned ? `Pinned ✓ (${pinned.lat.toFixed(4)}, ${pinned.lng.toFixed(4)})` : busy ? 'Getting GPS…' : 'Pin my current location'}
        </Text>
      </Pressable>
      <Text style={styles.hint}>Pin the drop when you&apos;re parked at it, or leave it — the office can set coordinates later.</Text>

      <Pressable style={styles.submit} onPress={save}>
        <Text style={styles.submitText}>Add drop</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20 },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginTop: 6, fontSize: 16 },
  pinBtn: { backgroundColor: '#eef2f1', borderRadius: 8, padding: 12, marginTop: 18, alignItems: 'center' },
  pinBtnText: { color: '#1f5f4f', fontWeight: '600' },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  submit: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
