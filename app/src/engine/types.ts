// Pure value types shared by the engine, the store and the UI.
// No React, no storage, no network in this folder — everything here is
// testable with `npm test`.

/** How the app leans when the AI is unsure about a portion. */
export type Bias = 'under' | 'honest' | 'over';

export type EnergyUnit = 'kcal' | 'kJ';

/** One food the AI (or the local table) recognised. Values are per the whole portion. */
export interface FoodItem {
  name: string;
  emoji: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type EntryStatus = 'pending' | 'ready' | 'failed' | 'limit';

export type EntrySource = 'photo' | 'text' | 'widget';

export interface Entry {
  id: string;
  /** Epoch ms when the user tapped. */
  createdAt: number;
  /** Local calendar day the entry belongs to, `YYYY-MM-DD`. */
  dayKey: string;
  source: EntrySource;
  status: EntryStatus;
  /** Raw estimates as returned — the bias multiplier is applied on top. */
  items: FoodItem[];
  /** Multiplier frozen at capture time, so changing the setting never rewrites history. */
  multiplier: number;
  /** User-applied portion scale from the edit sheet (1 = as estimated). */
  scale: number;
  photoUri?: string;
  text?: string;
  /** Short label the AI gave the whole plate ("Chicken salad"). */
  title?: string;
  attempts: number;
  /** Why a failed or blocked entry stopped — picks the message in the food list. */
  problem?: 'noFood' | 'network' | 'server' | 'trial';
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type Sex = 'female' | 'male';
export type Activity = 'low' | 'light' | 'moderate' | 'high';
export type GoalKind = 'lose' | 'maintain' | 'gain';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: GoalKind;
}

export interface Settings {
  goalKcal: number;
  bias: Bias;
  unit: EnergyUnit;
  partnerName: string;
  /** How the owner is named on their live share page. */
  shareName: string;
  nightLook: boolean;
  haptics: boolean;
  profile?: Profile;
  imperial: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  goalKcal: 2000,
  bias: 'honest',
  unit: 'kcal',
  partnerName: '',
  shareName: '',
  nightLook: true,
  haptics: true,
  imperial: false,
};
