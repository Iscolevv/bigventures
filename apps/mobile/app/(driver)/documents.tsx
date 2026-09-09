import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { DOCUMENT_TYPE_DEFS } from '@bv/core/reference';
import { db } from '@/lib/localdb';
import { runSync } from '@/lib/sync';
import { capturePhoto } from '@/lib/camera';

const DRIVER_DOCS = DOCUMENT_TYPE_DEFS.filter((d) => d.owner === 'driver');

export default function Documents() {
  const [rows, setRows] = useState<{ doc_type: string; sync_state: string }[]>([]);

  const load = useCallback(() => {
    setRows(db().getAllSync('SELECT doc_type, sync_state FROM documents ORDER BY doc_type'));
  }, []);
  useFocusEffect(useCallback(() => load(), [load]));

  async function upload(docType: string, label: string) {
    const photo = await capturePhoto();
    if (!photo) return;
    const id = Crypto.randomUUID();
    db().runSync(
      `INSERT INTO documents (client_id, doc_type, title, local_uri, mime_type, upload_state, sync_state)
       VALUES (?, ?, ?, ?, 'image/jpeg', 'pending', 'dirty')`,
      [id, docType, label, photo.uri],
    );
    runSync().catch(() => {});
    load();
    Alert.alert('Uploaded', `${label} will sync for the office to review.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>My documents</Text>
      <Text style={styles.sub}>Photograph each document. The office reviews and files them.</Text>

      {DRIVER_DOCS.map((d) => {
        const mine = rows.find((r) => r.doc_type === d.type);
        return (
          <View key={d.type} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>
                {d.label} {d.required ? <Text style={styles.req}>· required</Text> : null}
              </Text>
              {mine && (
                <Text style={styles.state}>
                  {mine.sync_state === 'synced' ? 'submitted' : mine.sync_state === 'conflict' ? 'rejected — retake' : 'pending sync'}
                </Text>
              )}
            </View>
            <Pressable style={styles.btn} onPress={() => upload(d.type, d.label)}>
              <Text style={styles.btnText}>{mine ? 'Replace' : 'Upload'}</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 60 },
  h1: { fontSize: 20, fontWeight: '700' },
  sub: { color: '#6b7280', marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingVertical: 14 },
  docLabel: { fontWeight: '600' },
  req: { color: '#b45309', fontWeight: '400', fontSize: 12 },
  state: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#1f5f4f', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  btnText: { color: 'white', fontWeight: '600' },
});
