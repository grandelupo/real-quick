import { dayKey, dayTotals, toUnit, weekdayIndex } from '../engine';
import type { State } from '../store';

// What every widget shows: today's payoff number, computed by the engine and
// written as a tiny snapshot so widgets render with no network and no app.

export interface WidgetSnapshot {
  day: string;
  weekday: number;
  kcal: number;
  goal: number;
  unit: 'kcal' | 'kJ';
  protein: number;
  carbs: number;
  fat: number;
  pending: number;
  /** Localised words baked in, so widgets need no i18n of their own. `left` is a template with `{n}`. */
  label: { of: string; left: string; snap: string; today: string };
}

export function buildSnapshot(s: State, label: WidgetSnapshot['label'], now = new Date()): WidgetSnapshot {
  const day = dayKey(now);
  const today = s.entries.filter((e) => e.dayKey === day);
  const tot = dayTotals(today);
  return {
    day,
    weekday: weekdayIndex(day),
    kcal: toUnit(tot.kcal, s.settings.unit),
    goal: toUnit(s.settings.goalKcal, s.settings.unit),
    unit: s.settings.unit,
    protein: Math.round(tot.protein),
    carbs: Math.round(tot.carbs),
    fat: Math.round(tot.fat),
    pending: today.filter((e) => e.status === 'pending').length,
    label,
  };
}

export const SNAPSHOT_KEY = 'realquick.widget';
export const APP_GROUP = 'group.com.latovi.realquick.shared';
export const SNAP_URL = 'realquick://snap?from=widget';
