import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { capturePhoto } from '@/lib/camera';

export default function FuelEntry() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = db().getFirstSync<{ vehicle_id: string }>('SELECT vehicle_id FROM trips WHERE client_id = ?', [tripId]);

  const [litres, setLitres] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [total, setTotal] = useState('');
  const [odometer, setOdometer] = useState('');
  const [station, setStation] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  function onLitres(v: string) {
    setLitres(v);
    if (unitPrice && v) setTotal((Number(v) * Number(unitPrice)).toFixed(0));
  }
  function onPrice(v: string) {
    setUnitPrice(v);
    if (litres && v) setTotal((Number(litres) * Number(v)).toFixed(0));
  }

  async function shootReceipt() {
    const p = await capturePhoto();
    if (p) setReceiptUri(p.uri);
  }

  function save() {
    if (!litres || !total || !odometer) {
      Alert.alert('Missing info', 'Litres, total cost and odometer are required.');
      return;
    }
    const id = Crypto.randomUUID();
    db().runSync(
      `INSERT INTO fuel_entries (client_id, vehicle_id, trip_client_id, litres, unit_price, total_cost, odometer_km, station, receipt_local_uri, filled_at, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dirty')`,
      [
        id,
        trip?.vehicle_id ?? '',
        tripId!,
        Number(litres),
        unitPrice ? Number(unitPrice) : null,
        Number(total),
        Number(odometer),
        station || null,
        receiptUri,
        new Date().toISOString(),
      ],
    );
    runSync().catch(() => {});
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Fuel entry</Text>

      <Text style={styles.label}>Litres</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={litres} onChangeText={onLitres} />

      <Text style={styles.label}>Price per litre (optional)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={unitPrice} onChangeText={onPrice} />

      <Text style={styles.label}>Total cost (KES)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={total} onChangeText={setTotal} />

      <Text style={styles.label}>Odometer (km)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={odometer} onChangeText={setOdometer} />

      <Text style={styles.label}>Station (optional)</Text>
      <TextInput style={styles.input} value={station} onChangeText={setStation} placeholder="e.g. Shell Industrial Area" />

      <Pressable style={styles.photoBtn} onPress={shootReceipt}>
        <Text style={styles.photoBtnText}>{receiptUri ? 'Receipt captured ✓ — retake' : 'Photograph the receipt'}</Text>
      </Pressable>
      {receiptUri && <Image source={{ uri: receiptUri }} style={styles.thumb} />}

      <Pressable style={styles.submit} onPress={save}>
        <Text style={styles.submitText}>Save fuel entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, marginTop: 6, fontSize: 16 },
  photoBtn: { backgroundColor: '#eef2f1', borderRadius: 8, padding: 12, marginTop: 20, alignItems: 'center' },
  photoBtnText: { color: '#1f5f4f', fontWeight: '600' },
  thumb: { width: 100, height: 100, borderRadius: 8, marginTop: 10, backgroundColor: '#eee' },
  submit: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
