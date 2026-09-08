import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';

/**
 * Guided, one-thing-per-step trip creation (Google-Forms style). This scaffold
 * captures the essentials; step 2+ (map pin confirmation, multi-drop entry,
 * directions API call for the planned route) land in Phase 1/2.
 */
export default function NewTrip() {
  const [vehicleId, setVehicleId] = useState('');
  const [loadingAddress, setLoadingAddress] = useState('');
  const [cargo, setCargo] = useState('');

  function create() {
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    db().runSync(
      `INSERT INTO trips (client_id, vehicle_id, status, loading_address, cargo_description, sync_state, updated_at)
       VALUES (?, ?, 'draft', ?, ?, 'dirty', ?)`,
      [id, vehicleId.trim(), loadingAddress.trim(), cargo.trim() || null, now],
    );
    runSync().catch(() => {});
    router.replace(`/(driver)/trip/${id}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.label}>Vehicle</Text>
      <TextInput style={styles.input} placeholder="Registration or ID" value={vehicleId} onChangeText={setVehicleId} />

      <Text style={styles.label}>Loading point</Text>
      <TextInput style={styles.input} placeholder="e.g. CST Yard, Industrial Area" value={loadingAddress} onChangeText={setLoadingAddress} />

      <Text style={styles.label}>Cargo (optional)</Text>
      <TextInput style={styles.input} placeholder="What are you carrying?" value={cargo} onChangeText={setCargo} />

      <Pressable style={[styles.button, (!vehicleId || !loadingAddress) && styles.disabled]} disabled={!vehicleId || !loadingAddress} onPress={create}>
        <Text style={styles.buttonText}>Create trip</Text>
      </Pressable>
      <Text style={styles.note}>Next you&apos;ll add drop points and complete the vehicle check before starting.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 8 },
  label: { fontWeight: '600', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  note: { color: '#6b7280', fontSize: 12, marginTop: 12 },
});
