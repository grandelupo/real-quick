// The Real Quick look: one calm pastel world per weekday, soft "clay"
// surfaces (depth from gradients and shadows, never outlines), one soft-3D
// object per day, and a deep indigo night after 20:00 (dark surfaces, light
// ink, the forest in moonlight). The app is fully branded — it ignores the
// system light/dark setting and follows the clock (see engine/days.ts
// isNight); sheets stay paper-white at night like system sheets.

import { Platform } from 'react-native';

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
  /** What a surface on this page casts: the day's own hue, deep and saturated. */
  shade: string;
  hero: HeroKind;
}

/** Index 0 = Monday. */
export const DAYS: DayPalette[] = [
  { name: 'mint', bg: '#E3F6EC', bgDeep: '#C4ECD9', glow: '#FFFFFF', ring: '#3FAF82', ringSoft: '#8FD8B6', shade: '#1B6349', hero: 'avocado' },
  { name: 'peach', bg: '#FFE9DC', bgDeep: '#FFD0B9', glow: '#FFF7F2', ring: '#F07E45', ringSoft: '#FFB88F', shade: '#8A3A17', hero: 'peach' },
  { name: 'lavender', bg: '#EEE9FF', bgDeep: '#D8CEFF', glow: '#FFFFFF', ring: '#7C63E0', ringSoft: '#B9A8F4', shade: '#3B2A7A', hero: 'grapes' },
  { name: 'butter', bg: '#FFF6D6', bgDeep: '#FFEAA6', glow: '#FFFDF2', ring: '#E0A417', ringSoft: '#F6D374', shade: '#7A560C', hero: 'lemon' },
  { name: 'bubblegum', bg: '#FFE6EF', bgDeep: '#FFCBDC', glow: '#FFF6F9', ring: '#EC5A8C', ringSoft: '#F9A4C2', shade: '#8C1F4A', hero: 'strawberry' },
  { name: 'sky', bg: '#E4F2FF', bgDeep: '#C6E3FF', glow: '#FFFFFF', ring: '#3F8ED6', ringSoft: '#96C6F2', shade: '#154677', hero: 'blueberries' },
  { name: 'matcha', bg: '#EEF5DB', bgDeep: '#DAEBB6', glow: '#FFFFFF', ring: '#6FA22E', ringSoft: '#B2D27D', shade: '#3C5A12', hero: 'pear' },
];

export const FONT = {
  display: 'PlusJakartaSans-Bold',
  displayBold: 'PlusJakartaSans-ExtraBold',
  displayMedium: 'PlusJakartaSans-SemiBold',
  body: 'PlusJakartaSans-Medium',
  bodyBold: 'PlusJakartaSans-SemiBold',
} as const;

export const RADIUS = { sm: 14, md: 20, lg: 28, xl: 34, pill: 999 } as const;

// ------------------------------------------------------------- shadows ---
// Nothing in the app casts a black shadow: light here is warm and the pages
// are saturated pastels, so a surface drops the page's own hue, deepened
// (DayPalette.shade), and a sheet on paper drops plum.
//
// Android never gets `elevation`. It ignores shadowColor on it (the shadow
// comes out black whatever we ask for), and it builds the shadow by
// tessellating the view's outline before blurring — on the 256pt ring disc
// the straight edges of that polygon show plainly through the translucent
// white. `boxShadow` (RN 0.76+) is drawn as a real blurred shape in the
// colour we give it, so both go away. iOS keeps the layer shadow, which it
// renders from the exact path.

/** Shadow on a paper-white sheet, where there is no day colour to borrow. */
export const PLUM = '#4A2B55';
/** After dark the page itself is deep indigo; shadows go cool and quiet. */
export const NIGHT_SHADE = '#0B0820';

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
}

export type ShadowSize = 'lg' | 'sm' | 'glow';
/** iOS shadowRadius is the blur's σ; CSS (and so boxShadow) wants 2σ. */
const SPEC = {
  lg: { opacity: 0.13, radius: 22, dy: 10 },
  sm: { opacity: 0.11, radius: 10, dy: 4 },
  /** A button lit from inside: its own colour, close and strong. */
  glow: { opacity: 0.45, radius: 16, dy: 8 },
} as const;

/** A soft shadow in `color`. Use `useShadow()` to pick up the page's own. */
export function shadowOf(color: string, size: ShadowSize = 'lg') {
  const { opacity, radius, dy } = SPEC[size];
  if (Platform.OS === 'android') return { boxShadow: `0px ${dy}px ${radius * 2}px ${rgba(color, opacity)}` };
  return { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: dy } };
}

/** Soft, wide shadow: a surface resting a little above the page. */
export const SHADOW = shadowOf(PLUM, 'lg');

/** Tighter shadow for small controls. */
export const SHADOW_SM = shadowOf(PLUM, 'sm');

/** Motion: short ease-out curves, nothing overshoots. */
export const DUR = { fast: 140, base: 260, slow: 420 } as const;

/** Spread into a style to cover the parent (StyleSheet.absoluteFillObject is gone in RN 0.86). */
export const ABS = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
