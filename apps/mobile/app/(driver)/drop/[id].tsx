import { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { DELIVERY_ISSUE_CATEGORIES } from '@bv/core/enums';
import type { DropStatus, DeliveryIssueCategory } from '@bv/core/enums';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { capturePhoto } from '@/lib/camera';

export default function DropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [drop, setDrop] = useState<any>(null);
  const [photos, setPhotos] = useState<{ client_id: string; local_uri: string }[]>([]);
  const [signee, setSignee] = useState('');
  const [issue, setIssue] = useState<DeliveryIssueCategory | null>(null);
  const [issueNotes, setIssueNotes] = useState('');

  const load = useCallback(() => {
    const d = db().getFirstSync<any>('SELECT * FROM drops WHERE client_id = ?', [id]);
    setDrop(d);
    setSignee(d?.signee_name ?? '');
    setPhotos(db().getAllSync('SELECT client_id, local_uri FROM pod_photos WHERE drop_client_id = ?', [id]));
  }, [id]);

  useFocusEffect(useCallback(() => load(), [load]));
  if (!drop) return <Text style={styles.pad}>Loading…</Text>;

  async function addPhoto() {
    const photo = await capturePhoto();
    if (!photo) return;
    let coords: { lat: number; lng: number } | null = null;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      /* offline / no fix — server still has the drop geofence */
    }
    db().runSync(
      `INSERT INTO pod_photos (client_id, drop_client_id, local_uri, captured_at, captured_lat, captured_lng, upload_state, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'dirty')`,
      [Crypto.randomUUID(), id!, photo.uri, new Date().toISOString(), coords?.lat ?? null, coords?.lng ?? null],
    );
    load();
  }

  function close(status: DropStatus) {
    if ((status === 'delivered' || status === 'partial') && photos.length === 0) {
      Alert.alert('Photo required', 'Capture at least one proof-of-delivery photo before closing this drop.');
      return;
    }
    if ((status === 'failed' || status === 'partial' || status === 'returned') && !issue) {
      Alert.alert('Pick a reason', 'Tell us what went wrong so the office can follow up.');
      return;
    }
    db().runSync(
      `UPDATE drops SET status = ?, signee_name = ?, issue_category = ?, issue_notes = ?, completed_at = ?, sync_state = 'dirty', updated_at = ? WHERE client_id = ?`,
      [status, signee || null, issue, issueNotes || null, new Date().toISOString(), new Date().toISOString(), id],
    );
    runSync().catch(() => {});
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>
        Stop {drop.sequence}: {drop.destination_address}
      </Text>
      <Text style={styles.meta}>Status: {drop.status}</Text>

      <Text style={styles.label}>Proof of delivery</Text>
      <View style={styles.photoRow}>
        {photos.map((p) => (
          <Image key={p.client_id} source={{ uri: p.local_uri }} style={styles.thumb} />
        ))}
        <Pressable style={styles.addPhoto} onPress={addPhoto}>
          <Text style={styles.addPhotoText}>+ Photo</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Received by (name)</Text>
      <TextInput style={styles.input} value={signee} onChangeText={setSignee} placeholder="Who signed for it?" />

      <Text style={styles.label}>Any issue?</Text>
      <View style={styles.chips}>
        {DELIVERY_ISSUE_CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setIssue(issue === c ? null : c)} style={[styles.chip, issue === c && styles.chipActive]}>
            <Text style={issue === c ? styles.chipTextActive : styles.chipText}>{c.replace('_', ' ')}</Text>
          </Pressable>
        ))}
      </View>
      {issue && (
        <TextInput style={styles.input} value={issueNotes} onChangeText={setIssueNotes} placeholder="Describe the issue" multiline />
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.ok]} onPress={() => close('delivered')}>
          <Text style={styles.btnText}>Delivered in full</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.amber]} onPress={() => close('partial')}>
          <Text style={styles.btnText}>Partial delivery</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.red]} onPress={() => close('failed')}>
          <Text style={styles.btnText}>Failed / returned</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  pad: { padding: 20 },
  h1: { fontSize: 18, fontWeight: '700' },
  meta: { color: '#6b7280', marginTop: 4 },
  label: { fontWeight: '600', marginTop: 18 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, marginTop: 6 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  addPhoto: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#1f5f4f', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { color: '#1f5f4f', fontWeight: '600', fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#b45309', borderColor: '#b45309' },
  chipText: { color: '#374151', fontSize: 13 },
  chipTextActive: { color: 'white', fontSize: 13 },
  actions: { marginTop: 24, gap: 10 },
  btn: { borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  ok: { backgroundColor: '#15803d' },
  amber: { backgroundColor: '#b45309' },
  red: { backgroundColor: '#b91c1c' },
});
