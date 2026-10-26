import type { Activity, Bias, Entry, FoodItem, GoalKind, Macros, Profile } from './types';

/**
 * Multipliers per bias. People under-report food by 10–30% in most studies,
 * so "over" leans further than "under" does.
 */
export const BIAS_MULTIPLIER: Record<Bias, number> = {
  under: 0.9,
  honest: 1,
  over: 1.15,
};

export const GOAL_MIN = 1000;
export const GOAL_MAX = 5000;
export const GOAL_STEP = 50;

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scaleMacros(m: Macros, k: number): Macros {
  return { kcal: m.kcal * k, protein: m.protein * k, carbs: m.carbs * k, fat: m.fat * k };
}

export function itemMacros(item: FoodItem): Macros {
  return { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };
}

/** What one entry contributes to the day, after bias and the user's portion edit. */
export function entryMacros(entry: Entry): Macros {
  if (entry.status !== 'ready') return ZERO;
  const raw = entry.items.map(itemMacros).reduce(add, ZERO);
  return scaleMacros(raw, entry.multiplier * entry.scale);
}

export function dayTotals(entries: Entry[]): Macros {
  return entries.map(entryMacros).reduce(add, ZERO);
}

/** Gram targets from a calorie goal: 25% protein, 45% carbs, 30% fat. */
export function macroTargets(goalKcal: number): Omit<Macros, 'kcal'> {
  return {
    protein: Math.round((goalKcal * 0.25) / 4),
    carbs: Math.round((goalKcal * 0.45) / 4),
    fat: Math.round((goalKcal * 0.3) / 9),
  };
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  low: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const GOAL_DELTA: Record<GoalKind, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

/** Mifflin–St Jeor resting energy. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

/** Daily goal for a profile, rounded to the stepper's 50 kcal grid and clamped to sane bounds. */
export function suggestedGoal(p: Profile): number {
  const tdee = bmr(p) * ACTIVITY_FACTOR[p.activity];
  // Never suggest eating below resting energy or below the safe floor.
  const floor = Math.max(p.sex === 'male' ? 1500 : 1200, bmr(p));
  const target = Math.max(tdee + GOAL_DELTA[p.goal], floor);
  return clampGoal(target);
}

export function clampGoal(kcal: number): number {
  const stepped = Math.round(kcal / GOAL_STEP) * GOAL_STEP;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, stepped));
}

export const KJ_PER_KCAL = 4.184;

export function toUnit(kcal: number, unit: 'kcal' | 'kJ'): number {
  return Math.round(unit === 'kJ' ? kcal * KJ_PER_KCAL : kcal);
}

/** 0…1+ — how far through the goal the day is. */
export function progress(totalKcal: number, goalKcal: number): number {
  if (goalKcal <= 0) return 0;
  return Math.max(0, totalKcal / goalKcal);
}

export type DayMood = 'empty' | 'started' | 'onTrack' | 'nailed' | 'over';

/** One word for the day, used by the share card and the header. */
export function dayMood(totalKcal: number, goalKcal: number): DayMood {
  const p = progress(totalKcal, goalKcal);
  if (totalKcal <= 0) return 'empty';
  if (p < 0.5) return 'started';
  if (p < 0.9) return 'onTrack';
  if (p <= 1.05) return 'nailed';
  return 'over';
}

export function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

export function kgToLb(kg: number): number {
  return kg / 0.45359237;
}

export function inToCm(inches: number): number {
  return inches * 2.54;
}

export function cmToIn(cm: number): number {
  return cm / 2.54;
}
