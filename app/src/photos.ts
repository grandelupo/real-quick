import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

// Photos live on the phone only. A capture is shrunk to 1024 px (enough for
// the model to read a plate, ~120 KB) and kept in the app's documents folder
// until it has been counted, then a small thumbnail replaces it.

const MAX_EDGE = 1024;
const THUMB_EDGE = 220;

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch {
    // already there
  }
  return dir;
}

/** Shrinks a fresh capture and stores it under `id`. Returns the stored URI. */
export async function storeCapture(uri: string, id: string, width?: number, height?: number): Promise<string> {
  const landscape = (width ?? 0) > (height ?? 0);
  const resize = landscape ? { width: MAX_EDGE } : { height: MAX_EDGE };
  const out = await manipulateAsync(uri, [{ resize }], { compress: 0.62, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });
  if (Platform.OS === 'web') return `data:image/jpeg;base64,${out.base64}`;
  const target = new File(photosDir(), `${id}.jpg`);
  try {
    if (target.exists) target.delete();
  } catch {}
  await new File(out.uri).move(target);
  return target.uri;
}

/** Base64 JPEG for the gateway. */
export async function readBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri.slice(uri.indexOf(',') + 1);
  return new File(uri).base64();
}

/** After counting: swap the full photo for a small thumbnail to keep storage tiny. */
export async function shrinkToThumb(uri: string, id: string): Promise<string> {
  if (Platform.OS === 'web') {
    const out = await manipulateAsync(uri, [{ resize: { width: THUMB_EDGE } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return `data:image/jpeg;base64,${out.base64}`;
  }
  const out = await manipulateAsync(uri, [{ resize: { width: THUMB_EDGE } }], { compress: 0.6, format: SaveFormat.JPEG });
  const target = new File(photosDir(), `${id}-t.jpg`);
  try {
    if (target.exists) target.delete();
  } catch {}
  await new File(out.uri).move(target);
  deletePhoto(uri);
  return target.uri;
}

export function deletePhoto(uri?: string) {
  if (!uri || uri.startsWith('data:') || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

export function deleteAllPhotos() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (dir.exists) dir.delete();
  } catch {}
}
