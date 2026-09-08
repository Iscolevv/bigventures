import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { VEHICLE_CHECK_TEMPLATE, BLOCKING_CHECK_KEYS } from '@bv/core/reference';
import type { CheckItemResult } from '@bv/core/enums';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { capturePhoto } from '@/lib/camera';

type ItemState = { result: CheckItemResult | null; value?: string; photoUri?: string; notes?: string };

export default function VehicleCheck() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = useMemo(
    () => db().getFirstSync<{ vehicle_id: string; status: string }>('SELECT vehicle_id, status FROM trips WHERE client_id = ?', [tripId]),
    [tripId],
  );
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(VEHICLE_CHECK_TEMPLATE.map((c) => [c.key, { result: null }])),
  );
  const [odometer, setOdometer] = useState('');

  function set(key: string, patch: Partial<ItemState>) {
    setItems((s) => ({ ...s, [key]: { ...s[key]!, ...patch } }));
  }

  async function shootFor(key: string) {
    const photo = await capturePhoto();
    if (photo) set(key, { photoUri: photo.uri });
  }

  const blockingFailed = VEHICLE_CHECK_TEMPLATE.filter(
    (c) => BLOCKING_CHECK_KEYS.has(c.key) && items[c.key]?.result === 'fail',
  );
  const anyUnanswered = VEHICLE_CHECK_TEMPLATE.some((c) => items[c.key]?.result == null);

  async function submit() {
    if (anyUnanswered) {
      Alert.alert('Finish the checklist', 'Every item needs a Pass, Fail or N/A.');
      return;
    }
    const anyFail = VEHICLE_CHECK_TEMPLATE.some((c) => items[c.key]?.result === 'fail');
    const overall = blockingFailed.length ? 'fail' : anyFail ? 'flagged' : 'pass';
    const checkId = Crypto.randomUUID();

    db().runSync(
      `INSERT INTO vehicle_checks (client_id, trip_client_id, vehicle_id, performed_at, overall_result, odometer_km, items_json, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'dirty')`,
      [
        checkId,
        tripId!,
        trip?.vehicle_id ?? '',
        new Date().toISOString(),
        overall,
        odometer ? Number(odometer) : null,
        JSON.stringify(
          VEHICLE_CHECK_TEMPLATE.map((c) => ({
            key: c.key,
            result: items[c.key]!.result,
            value: items[c.key]!.value,
            notes: items[c.key]!.notes,
            // photoUri is uploaded on sync; see camera/uploads pipeline
          })),
        ),
      ],
    );

    if (overall === 'fail') {
      db().runSync("UPDATE trips SET status = 'pre_check', sync_state = 'dirty', updated_at = ? WHERE client_id = ?", [new Date().toISOString(), tripId]);
      Alert.alert('Trip blocked', 'A safety-critical item failed. Operations must clear this before you can start.');
    } else {
      db().runSync("UPDATE trips SET status = 'pre_check', sync_state = 'dirty', updated_at = ? WHERE client_id = ?", [new Date().toISOString(), tripId]);
    }
    runSync().catch(() => {});
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Pre-trip vehicle check</Text>
      <Text style={styles.sub}>All safety-critical items must pass before you can start driving.</Text>

      <Text style={styles.label}>Odometer (km)</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={odometer} onChangeText={setOdometer} placeholder="Current reading" />

      {VEHICLE_CHECK_TEMPLATE.map((c) => {
        const st = items[c.key]!;
        return (
          <View key={c.key} style={styles.item}>
            <Text style={styles.itemLabel}>
              {c.label} {c.blocking ? <Text style={styles.blocking}>· critical</Text> : null}
            </Text>
            <View style={styles.row}>
              {(['pass', 'fail', 'na'] as CheckItemResult[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => set(c.key, { result: r })}
                  style={[styles.choice, st.result === r && styles.choiceActive]}
                >
                  <Text style={st.result === r ? styles.choiceTextActive : styles.choiceText}>{r.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            {c.valueHint && (
              <TextInput
                style={styles.input}
                placeholder={c.valueHint}
                value={st.value}
                onChangeText={(v) => set(c.key, { value: v })}
              />
            )}
            {st.result === 'fail' && (
              <View>
                <Pressable style={styles.photoBtn} onPress={() => shootFor(c.key)}>
                  <Text style={styles.photoBtnText}>{st.photoUri ? 'Photo captured ✓ — retake' : 'Take a photo of the fault'}</Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  placeholder="What's wrong?"
                  value={st.notes}
                  onChangeText={(v) => set(c.key, { notes: v })}
                />
              </View>
            )}
          </View>
        );
      })}

      {blockingFailed.length > 0 && (
        <Text style={styles.warn}>
          {blockingFailed.length} safety-critical item(s) failed — the trip will be held for operations.
        </Text>
      )}

      <Pressable style={styles.submit} onPress={submit}>
        <Text style={styles.submitText}>Submit check</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  h1: { fontSize: 20, fontWeight: '700' },
  sub: { color: '#6b7280', marginTop: 4, marginBottom: 12 },
  label: { fontWeight: '600', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, marginTop: 6 },
  item: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  itemLabel: { fontWeight: '600' },
  blocking: { color: '#b45309', fontWeight: '400', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, alignItems: 'center' },
  choiceActive: { backgroundColor: '#1f5f4f', borderColor: '#1f5f4f' },
  choiceText: { color: '#374151', fontWeight: '600' },
  choiceTextActive: { color: 'white', fontWeight: '700' },
  photoBtn: { backgroundColor: '#eef2f1', borderRadius: 8, padding: 12, marginTop: 8, alignItems: 'center' },
  photoBtnText: { color: '#1f5f4f', fontWeight: '600' },
  warn: { color: '#b45309', marginTop: 16 },
  submit: { backgroundColor: '#1f5f4f', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
