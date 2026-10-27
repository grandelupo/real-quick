import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

// Photos live on the phone only. A capture is shrunk to 1024 px (enough for
// the model to read a plate, ~120 KB) and kept in the app's documents folder
// until it has been counted, then a small thumbnail replaces it.
//
// Entries keep a *relative* name (`photos/<id>-t.jpg`), never an absolute
// URI: iOS moves the app container on every install and update, so a stored
// `file:///…/Documents/photos/x.jpg` goes dead at the next TestFlight build
// while the file itself survives. `photoSrc()` resolves a name when it is
// shown, and still accepts the absolute URIs older builds wrote.

const MAX_EDGE = 1024;
const THUMB_EDGE = 220;
const DIR = 'photos';

function photosDir(): Directory {
  const dir = new Directory(Paths.document, DIR);
  try {
    dir.create({ intermediates: true, idempotent: true });
  } catch {
    // already there
  }
  return dir;
}

/** The file behind a stored reference, relative name or legacy absolute URI. */
function fileFor(ref: string): File {
  if (ref.startsWith('file:')) {
    // an older build's absolute path: the file is in today's container under the same name
    const name = decodeURIComponent(ref.slice(ref.lastIndexOf('/') + 1));
    return new File(photosDir(), name);
  }
  return new File(Paths.document, ref);
}

/** What to hand to <Image>: a URI for a stored reference (undefined stays undefined). */
export function photoSrc(ref?: string): string | undefined {
  if (!ref || ref.startsWith('data:') || ref.startsWith('http')) return ref;
  if (Platform.OS === 'web') return ref;
  try {
    return fileFor(ref).uri;
  } catch {
    return undefined;
  }
}

/** Shrinks a fresh capture and stores it under `id`. Returns the stored reference. */
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
  return `${DIR}/${id}.jpg`;
}

/** Base64 JPEG for the gateway. */
export async function readBase64(ref: string): Promise<string> {
  if (ref.startsWith('data:')) return ref.slice(ref.indexOf(',') + 1);
  return fileFor(ref).base64();
}

/** After counting: swap the full photo for a small thumbnail to keep storage tiny. */
export async function shrinkToThumb(ref: string, id: string): Promise<string> {
  if (Platform.OS === 'web') {
    const out = await manipulateAsync(ref, [{ resize: { width: THUMB_EDGE } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return `data:image/jpeg;base64,${out.base64}`;
  }
  const source = fileFor(ref).uri;
  const out = await manipulateAsync(source, [{ resize: { width: THUMB_EDGE } }], { compress: 0.6, format: SaveFormat.JPEG });
  const target = new File(photosDir(), `${id}-t.jpg`);
  try {
    if (target.exists) target.delete();
  } catch {}
  await new File(out.uri).move(target);
  deletePhoto(ref);
  return `${DIR}/${id}-t.jpg`;
}

export function deletePhoto(ref?: string) {
  if (!ref || ref.startsWith('data:') || Platform.OS === 'web') return;
  try {
    const f = fileFor(ref);
    if (f.exists) f.delete();
  } catch {}
}

export function deleteAllPhotos() {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, DIR);
    if (dir.exists) dir.delete();
  } catch {}
}
