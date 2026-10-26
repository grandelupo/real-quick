import type { FoodItem } from './types';

// The gateway's answer is untrusted input: models occasionally return a
// negative gram weight, a string where a number belongs, or forty items for
// one plate. Everything that reaches the store passes through here.

const MAX_ITEMS = 12;

function num(v: unknown, max: number): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function text(v: unknown, fallback: string, maxLen: number): string {
  if (typeof v !== 'string') return fallback;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, maxLen) : fallback;
}

/** First grapheme-ish emoji, or a plate. */
function emoji(v: unknown): string {
  if (typeof v !== 'string') return '🍽️';
  const t = v.trim();
  if (!t || /^[\p{L}\p{N}\s]+$/u.test(t)) return '🍽️';
  return Array.from(t).slice(0, 2).join('');
}

export function sanitizeItem(raw: unknown): FoodItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const protein = num(r.protein, 400);
  const carbs = num(r.carbs, 800);
  const fat = num(r.fat, 400);
  let kcal = num(r.kcal, 6000);
  // A model that forgets kcal but gives macros still gets counted.
  if (kcal === 0 && protein + carbs + fat > 0) kcal = protein * 4 + carbs * 4 + fat * 9;
  const name = text(r.name, '', 60);
  if (!name) return null;
  return {
    name,
    emoji: emoji(r.emoji),
    grams: Math.round(num(r.grams, 5000)),
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

export interface Analysis {
  title: string;
  items: FoodItem[];
  /** True when the photo plainly shows no food (a desk, a cat). */
  noFood: boolean;
}

export function sanitizeAnalysis(raw: unknown): Analysis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.items) ? r.items : [];
  const items = list.map(sanitizeItem).filter((x): x is FoodItem => x !== null).slice(0, MAX_ITEMS);
  const title = text(r.title, items[0]?.name ?? '', 60);
  return { title, items, noFood: items.length === 0 };
}
