/**
 * Downscale + re-encode a photo before it ever leaves the phone. A modern
 * camera photo is routinely 3-10MB; nothing we store (POD, receipts,
 * documents) needs the original resolution, and every one of those MB is
 * Vercel Blob storage + bandwidth we pay for and a slower upload for the
 * driver on mobile data. Runs entirely client-side via canvas - if anything
 * about it fails (old browser, corrupt file), we fall back to the original
 * file rather than block the upload.
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.72;

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  if (typeof document === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() =>
      createImageBitmap(file),
    );
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // compression didn't actually help - keep the original

    const jpgName = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], jpgName, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
