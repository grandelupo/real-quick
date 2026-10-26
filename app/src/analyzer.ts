import { AppState } from 'react-native';
import { ApiError, analyzePhoto, analyzeText } from './api';
import { readBase64, shrinkToThumb } from './photos';
import { getState, onChange, updateEntry } from './store';
import { dayKey, type Entry } from './engine';

// Background counter: walks pending entries one by one. A snap taken on the
// underground is not lost — it waits, and is counted when the phone is back
// online (on the next app foreground or the retry timer).

const MAX_ATTEMPTS = 6;
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function backoff(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** attempts);
}

function nextPending(): Entry | undefined {
  return getState().entries.find((e) => e.status === 'pending');
}

async function processOne(e: Entry) {
  try {
    const result = e.photoUri ? await analyzePhoto(await readBase64(e.photoUri)) : await analyzeText(e.text ?? '');
    if (result.noFood) {
      updateEntry(e.id, { status: 'failed', problem: 'noFood', attempts: e.attempts + 1 });
      return;
    }
    updateEntry(e.id, { status: 'ready', items: result.items, title: result.title, problem: undefined, attempts: e.attempts + 1 });
    if (e.photoUri) {
      try {
        const thumb = await shrinkToThumb(e.photoUri, e.id);
        updateEntry(e.id, { photoUri: thumb });
      } catch {
        // keep the full photo; harmless
      }
    }
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'network';
    if (code === 'daily_limit') {
      updateEntry(e.id, { status: 'limit', attempts: e.attempts + 1 });
      return;
    }
    const attempts = e.attempts + 1;
    if (code === 'bad_request' || attempts >= MAX_ATTEMPTS) {
      updateEntry(e.id, { status: 'failed', problem: code === 'network' ? 'network' : 'server', attempts });
      return;
    }
    // Leave it pending and come back later.
    updateEntry(e.id, { attempts });
    throw Object.assign(new Error('retry'), { wait: backoff(attempts) });
  }
}

/** Entries that hit the free limit on an earlier day get a fresh quota today. */
function releaseStaleLimits() {
  const today = dayKey(new Date());
  for (const e of getState().entries) {
    if (e.status === 'limit' && (e.dayKey < today || getState().isPro)) updateEntry(e.id, { status: 'pending', attempts: 0 });
  }
}

export async function pump() {
  if (running) return;
  running = true;
  releaseStaleLimits();
  try {
    // Skip entries that are waiting for a retry slot by processing in order;
    // a network failure stops the loop so we don't hammer a dead connection.
    for (let e = nextPending(); e; e = nextPending()) {
      try {
        await processOne(e);
      } catch (err) {
        const wait = (err as { wait?: number }).wait ?? 10_000;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void pump(), wait);
        break;
      }
    }
  } finally {
    running = false;
  }
}

/** Retry a failed or limit-blocked entry by hand. */
export function retry(id: string) {
  updateEntry(id, { status: 'pending', problem: undefined, attempts: 0 });
  void pump();
}

let started = false;
export function startAnalyzer() {
  if (started) return;
  started = true;
  let lastPending = 0;
  let lastPro = getState().isPro;
  onChange((s) => {
    const pending = s.entries.filter((e) => e.status === 'pending').length;
    if (pending > lastPending) void pump();
    lastPending = pending;
    // Buying Pro unblocks today's limit-blocked snaps straight away.
    if (s.isPro && !lastPro) void pump();
    lastPro = s.isPro;
  });
  AppState.addEventListener('change', (st) => {
    if (st === 'active') void pump();
  });
  void pump();
}
