/**
 * Client-side photo pipeline: downscale + compress, hash, upload to the backend
 * (which stores it in Vercel Blob / R2 and returns a key). Runs before sync so
 * the batch only carries storage keys. Retry-safe: a half-uploaded photo just
 * re-runs.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL } from './config';
import { getToken, getDeviceId } from './auth';
import { PHOTO } from './config';

export interface PreparedFile {
  uri: string;
  sha256: string;
  size: number;
  contentType: string;
}

export async function preparePhoto(uri: string): Promise<PreparedFile> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: PHOTO.maxWidth } }],
    { compress: PHOTO.quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  const info = await FileSystem.getInfoAsync(manipulated.uri, { size: true });
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
  return {
    uri: manipulated.uri,
    sha256,
    size: info.exists && 'size' in info ? (info.size ?? 0) : 0,
    contentType: 'image/jpeg',
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const [token, deviceId] = await Promise.all([getToken(), getDeviceId()]);
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'x-device-id': deviceId,
  };
}

/** Upload a prepared file; returns its storage key. */
export async function uploadFile(
  kind: 'pod' | 'receipt' | 'document' | 'check',
  file: PreparedFile,
  _filename: string,
): Promise<string> {
  const res = await FileSystem.uploadAsync(`${API_BASE_URL}/api/mobile/upload`, file.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: file.contentType,
    parameters: { kind },
    headers: await authHeaders(),
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`upload failed: ${res.status} ${res.body?.slice(0, 120)}`);
  }
  const body = JSON.parse(res.body) as { key?: string };
  if (!body.key) throw new Error('upload returned no key');
  return body.key;
}
