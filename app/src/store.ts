import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { BIAS_MULTIPLIER, DEFAULT_SETTINGS, dayKey, isNight, type Entry, type EntrySource, type FoodItem, type Settings } from './engine';

// One small observable store, persisted as a single JSON blob. Everything
// the user owns lives here, on the phone — there are no accounts.

export interface State {
  loaded: boolean;
  onboarded: boolean;
  settings: Settings;
  entries: Entry[];
  /** Lifetime snaps; the big button collapses after a few (engine/days.ts). */
  totalSnaps: number;
  /** Gestures the user has performed at least once; the hints stop afterwards. */
  seen: { scroll: boolean; notes: boolean };
  isPro: boolean;
  /** Store receipt the gateway verifies (iOS JWS / Play purchase token). */
  proToken?: string;
  /** Pro from a coupon code: the last day it covers (the gateway keeps the same date). */
  proUntil?: string;
  installId: string;
  /** First day the app was used: the day pager's reach and the start of the free days. */
  firstDay?: string;
  /** Live share, while on: the token and public link the gateway gave us. */
  share?: { token: string; url: string };
  /** The last day the mascot intro played; it plays once per day. */
  introDay?: string;
  /** Entries added after dark while the night look is off; at 5 the app offers it once. */
  nightSnaps: number;
  nightOffered: boolean;
}

const KEY = 'realquick.v1';

let state: State = {
  loaded: false,
  onboarded: false,
  settings: DEFAULT_SETTINGS,
  entries: [],
  totalSnaps: 0,
  seen: { scroll: false, notes: false },
  isPro: false,
  installId: '',
  nightSnaps: 0,
  nightOffered: false,
};

const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const changeHooks = new Set<(s: State) => void>();

function emit() {
  for (const l of listeners) l();
  for (const h of changeHooks) h(state);
  if (!state.loaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 250);
}

async function persist() {
  const { loaded: _loaded, ...rest } = state;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Storage full or unavailable: the in-memory state keeps working.
  }
}

export function getState(): State {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Side effects that follow every change (widget snapshot, analysis queue). */
export function onChange(h: (s: State) => void) {
  changeHooks.add(h);
  return () => changeHooks.delete(h);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export async function load() {
  let saved: Partial<State> = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = {};
  }
  const installId = saved.installId || Crypto.randomUUID();
  // A capture interrupted by the app being killed is retried, not lost.
  const entries = (saved.entries ?? []).map((e) => ({ ...e, scale: e.scale ?? 1, attempts: e.attempts ?? 0 }));
  state = {
    ...state,
    ...saved,
    settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
    seen: { scroll: false, notes: false, ...(saved.seen ?? {}) },
    entries,
    installId,
    firstDay: saved.firstDay ?? dayKey(new Date()),
    loaded: true,
  };
  emit();
}

export function newId(): string {
  return Crypto.randomUUID();
}

export function addEntry(input: { source: EntrySource; photoUri?: string; text?: string; items?: FoodItem[]; title?: string; id?: string; at?: Date }): Entry {
  const at = input.at ?? new Date();
  const entry: Entry = {
    id: input.id ?? newId(),
    createdAt: at.getTime(),
    dayKey: dayKey(at),
    source: input.source,
    status: input.items ? 'ready' : 'pending',
    items: input.items ?? [],
    multiplier: BIAS_MULTIPLIER[state.settings.bias],
    scale: 1,
    photoUri: input.photoUri,
    text: input.text,
    title: input.title,
    attempts: 0,
  };
  setState((s) => ({
    entries: [...s.entries, entry],
    totalSnaps: input.source === 'text' ? s.totalSnaps : s.totalSnaps + 1,
    nightSnaps: !s.settings.nightLook && isNight(at) ? (s.nightSnaps ?? 0) + 1 : s.nightSnaps ?? 0,
  }));
  return entry;
}

export function updateEntry(id: string, patch: Partial<Entry>) {
  setState((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

export function removeEntry(id: string): Entry | undefined {
  const gone = state.entries.find((e) => e.id === id);
  setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  return gone;
}

export function markSeen(what: keyof State['seen']) {
  if (state.seen[what]) return;
  setState((s) => ({ seen: { ...s.seen, [what]: true } }));
}

export function setSettings(patch: Partial<Settings>) {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
}

export async function eraseAll() {
  const installId = state.installId;
  state = {
    loaded: true,
    onboarded: false,
    settings: DEFAULT_SETTINGS,
    entries: [],
    totalSnaps: 0,
      seen: { scroll: false, notes: false },
    isPro: state.isPro, // a subscription belongs to the Apple/Google account, not this data
    proUntil: state.proUntil,
    nightSnaps: 0,
    nightOffered: false,
    installId,
    firstDay: dayKey(new Date()),
  };
  emit();
}

export function entriesFor(day: string, entries: Entry[]): Entry[] {
  return entries.filter((e) => e.dayKey === day).sort((a, b) => a.createdAt - b.createdAt);
}
