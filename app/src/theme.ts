// The Real Quick look: one calm pastel world per weekday, soft "clay"
// surfaces (depth from gradients and shadows, never outlines), one soft-3D
// object per day, and a deep indigo night after 20:00 (dark surfaces, light
// ink, the forest in moonlight). The app is fully branded — it ignores the
// system light/dark setting and follows the clock (see engine/days.ts
// isNight); sheets stay paper-white at night like system sheets.

export const INK = '#2B2350';
export const INK_SOFT = 'rgba(43,35,80,0.60)';
export const INK_FAINT = 'rgba(43,35,80,0.10)';
export const INK_HAIR = 'rgba(43,35,80,0.07)';
export const PAPER = '#FFFDF9';
export const SURFACE = '#FFFFFF';
export const NIGHT_BG = '#1F1C3A';
export const NIGHT_DEEP = '#2B2756';
/** The page's night colours (ui/night.tsx hands them out). */
export const NIGHT = {
  ink: '#F3F0FF',
  inkSoft: 'rgba(243,240,255,0.62)',
  hair: 'rgba(255,255,255,0.10)',
  surface: '#312C5C',
  surfaceSoft: 'rgba(49,44,92,0.88)',
} as const;
export const BLUSH = '#FF9EB5';
export const BLUSH_DEEP = '#F77F9F';

export const MACRO = {
  protein: '#FF7F70',
  carbs: '#FFB938',
  fat: '#46BFA0',
} as const;

/** The soft-3D object that belongs to a weekday (assets/art/<kind>.png). */
export type HeroKind = 'avocado' | 'peach' | 'grapes' | 'lemon' | 'strawberry' | 'blueberries' | 'pear';

export interface DayPalette {
  name: string;
  /** Top and bottom of the page gradient. */
  bg: string;
  bgDeep: string;
  /** Colour of the soft light orbs floating in the background. */
  glow: string;
  /** Colour of the progress ring on this day (light → strong). */
  ring: string;
  ringSoft: string;
  hero: HeroKind;
}

/** Index 0 = Monday. */
export const DAYS: DayPalette[] = [
  { name: 'mint', bg: '#E3F6EC', bgDeep: '#C4ECD9', glow: '#FFFFFF', ring: '#3FAF82', ringSoft: '#8FD8B6', hero: 'avocado' },
  { name: 'peach', bg: '#FFE9DC', bgDeep: '#FFD0B9', glow: '#FFF7F2', ring: '#F07E45', ringSoft: '#FFB88F', hero: 'peach' },
  { name: 'lavender', bg: '#EEE9FF', bgDeep: '#D8CEFF', glow: '#FFFFFF', ring: '#7C63E0', ringSoft: '#B9A8F4', hero: 'grapes' },
  { name: 'butter', bg: '#FFF6D6', bgDeep: '#FFEAA6', glow: '#FFFDF2', ring: '#E0A417', ringSoft: '#F6D374', hero: 'lemon' },
  { name: 'bubblegum', bg: '#FFE6EF', bgDeep: '#FFCBDC', glow: '#FFF6F9', ring: '#EC5A8C', ringSoft: '#F9A4C2', hero: 'strawberry' },
  { name: 'sky', bg: '#E4F2FF', bgDeep: '#C6E3FF', glow: '#FFFFFF', ring: '#3F8ED6', ringSoft: '#96C6F2', hero: 'blueberries' },
  { name: 'matcha', bg: '#EEF5DB', bgDeep: '#DAEBB6', glow: '#FFFFFF', ring: '#6FA22E', ringSoft: '#B2D27D', hero: 'pear' },
];

export const FONT = {
  display: 'PlusJakartaSans-Bold',
  displayBold: 'PlusJakartaSans-ExtraBold',
  displayMedium: 'PlusJakartaSans-SemiBold',
  body: 'PlusJakartaSans-Medium',
  bodyBold: 'PlusJakartaSans-SemiBold',
} as const;

export const RADIUS = { sm: 14, md: 20, lg: 28, xl: 34, pill: 999 } as const;

/** Soft, wide shadow: a surface resting a little above the page. */
export const SHADOW = {
  shadowColor: INK,
  shadowOpacity: 0.1,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
} as const;

/** Tighter shadow for small controls. */
export const SHADOW_SM = {
  shadowColor: INK,
  shadowOpacity: 0.09,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

/** Motion: short ease-out curves, nothing overshoots. */
export const DUR = { fast: 140, base: 260, slow: 420 } as const;

/** Spread into a style to cover the parent (StyleSheet.absoluteFillObject is gone in RN 0.86). */
export const ABS = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
