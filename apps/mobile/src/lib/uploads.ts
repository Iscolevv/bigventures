/**
 * Client-side photo pipeline: downscale + compress, hash, get a presigned R2
 * PUT, upload directly. Runs before sync so the batch only carries storage
 * keys. Everything is retry-safe: a half-uploaded photo just re-runs.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { apiFetch } from './auth';
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

export async function uploadFile(
  kind: 'pod' | 'receipt' | 'document' | 'check',
  file: PreparedFile,
  filename: string,
): Promise<string> {
  const presignRes = await apiFetch('/api/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({ kind, filename, contentType: file.contentType }),
  });
  if (!presignRes.ok) throw new Error(`presign failed: ${presignRes.status}`);
  const { url, key } = (await presignRes.json()) as { url: string; key: string };

  const put = await FileSystem.uploadAsync(url, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'content-type': file.contentType },
  });
  if (put.status < 200 || put.status >= 300) throw new Error(`upload failed: ${put.status}`);
  return key;
}
