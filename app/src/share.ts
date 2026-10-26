import { AppState } from 'react-native';
import { deleteShare, putShare, type SharePayload } from './api';
import { dayTotals, entryMacros, type Entry } from './engine';
import { locale } from './i18n';
import { getState, onChange, setSettings, setState, type State } from './store';

// Live sharing: while it is on, a summary of every day (totals and entry
// titles — never photos) is pushed to the gateway, debounced, and the partner's
// link keeps showing today and the history. Stop sharing and the page is gone.

function hhmm(ms: number) {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function buildSharePayload(s: State): SharePayload {
  const byDay = new Map<string, Entry[]>();
  for (const e of s.entries) {
    const list = byDay.get(e.dayKey) ?? [];
    list.push(e);
    byDay.set(e.dayKey, list);
  }
  const days: SharePayload['days'] = {};
  for (const [day, list] of byDay) {
    const t = dayTotals(list);
    days[day] = {
      kcal: Math.round(t.kcal),
      goal: s.settings.goalKcal,
      protein: Math.round(t.protein),
      carbs: Math.round(t.carbs),
      fat: Math.round(t.fat),
      entries: list
        .filter((e) => e.status === 'ready')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((e) => ({ t: hhmm(e.createdAt), title: e.title ?? e.items[0]?.name ?? e.text ?? '', kcal: Math.round(entryMacros(e).kcal) })),
    };
  }
  return { name: s.settings.shareName, unit: s.settings.unit, days };
}

export async function startSharing(name: string): Promise<string> {
  setSettings({ shareName: name.trim().slice(0, 40) });
  const r = await putShare(buildSharePayload(getState()));
  setState({ share: { token: r.token, url: r.url } });
  return r.url;
}

export async function stopSharing(): Promise<void> {
  await deleteShare();
  setState({ share: undefined });
}

let started = false;
export function startShareSync() {
  if (started) return;
  started = true;
  let last = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const push = () => {
    const s = getState();
    if (!s.share) return;
    const payload = buildSharePayload(s);
    const sig = JSON.stringify(payload);
    if (sig === last) return;
    last = sig;
    void putShare(payload).catch(() => {
      last = ''; // try again on the next change
    });
  };
  onChange((s) => {
    if (!s.share) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 3000);
  });
  AppState.addEventListener('change', (st) => {
    if (st === 'active') push();
  });
}
