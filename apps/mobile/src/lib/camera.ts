/**
 * Camera-only capture. We deliberately use `launchCameraAsync` (never the
 * media library) so a proof-of-delivery photo can't be an old/reused image.
 * The returned photo is compressed by the uploads pipeline before it leaves
 * the device.
 */
import * as ImagePicker from 'expo-image-picker';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export async function capturePhoto(): Promise<CapturedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    exif: false,
    cameraType: ImagePicker.CameraType.back,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width ?? 0, height: a.height ?? 0 };
}
