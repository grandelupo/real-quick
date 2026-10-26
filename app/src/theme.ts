// The Real Quick look: one pastel world per weekday, soft food doodles, a
// dark-navy ink line (the house sticker outline), and a white night look.
// The app is fully branded — it deliberately ignores the system light/dark
// setting and follows the clock instead (see engine/days.ts isNight).

export const INK = '#2B2350';
export const INK_SOFT = 'rgba(43,35,80,0.62)';
export const INK_FAINT = 'rgba(43,35,80,0.12)';
export const PAPER = '#FFFDF7';
export const NIGHT_BG = '#FBFAF8';
export const BLUSH = '#FF9EB5';

export const MACRO = {
  protein: '#FF7F70',
  carbs: '#FFB938',
  fat: '#46BFA0',
} as const;

export type FoodKind =
  | 'avocado' | 'pea' | 'kiwi'
  | 'peach' | 'croissant' | 'carrot'
  | 'grapes' | 'plum' | 'macaron'
  | 'banana' | 'lemon' | 'egg'
  | 'strawberry' | 'donut' | 'cherry'
  | 'blueberry' | 'icecream' | 'cupcake'
  | 'pizza' | 'tomato' | 'pear';

export interface DayPalette {
  name: string;
  bg: string;
  bgDeep: string;
  /** Doodle fill colours, light → strong. */
  art: [string, string, string];
  /** Colour of the progress ring on this day. */
  ring: string;
  foods: [FoodKind, FoodKind, FoodKind];
}

/** Index 0 = Monday. */
export const DAYS: DayPalette[] = [
  { name: 'mint', bg: '#CFF2E2', bgDeep: '#B5E9D2', art: ['#E9FAF2', '#9FDDBF', '#5FBF95'], ring: '#3FAF82', foods: ['avocado', 'pea', 'kiwi'] },
  { name: 'peach', bg: '#FFDCC9', bgDeep: '#FFC9AE', art: ['#FFF1E8', '#FFB98F', '#F48F5E'], ring: '#F07E45', foods: ['peach', 'croissant', 'carrot'] },
  { name: 'lavender', bg: '#E4DCFF', bgDeep: '#D3C7FF', art: ['#F4F0FF', '#BBA9F7', '#8F78E8'], ring: '#7C63E0', foods: ['grapes', 'plum', 'macaron'] },
  { name: 'butter', bg: '#FFF1B8', bgDeep: '#FFE68A', art: ['#FFFAE0', '#FFDA5C', '#F2B630'], ring: '#E0A417', foods: ['banana', 'lemon', 'egg'] },
  { name: 'bubblegum', bg: '#FFD8E6', bgDeep: '#FFC2D8', art: ['#FFF0F5', '#FF9FC1', '#F06A98'], ring: '#EC5A8C', foods: ['strawberry', 'donut', 'cherry'] },
  { name: 'sky', bg: '#D3ECFF', bgDeep: '#BCE1FF', art: ['#EEF7FF', '#97CBF5', '#5C9FDB'], ring: '#3F8ED6', foods: ['blueberry', 'icecream', 'cupcake'] },
  { name: 'matcha', bg: '#E2F0C6', bgDeep: '#D2E8A8', art: ['#F3F9E6', '#B6D77A', '#86B443'], ring: '#6FA22E', foods: ['pizza', 'tomato', 'pear'] },
];

export const FONT = {
  display: 'Fredoka-SemiBold',
  displayBold: 'Fredoka-Bold',
  displayMedium: 'Fredoka-Medium',
  body: 'Nunito-SemiBold',
  bodyBold: 'Nunito-ExtraBold',
} as const;

export const RADIUS = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

/** Soft drop shadow that reads as "sticker lifted off the page". */
export const SHADOW = {
  shadowColor: INK,
  shadowOpacity: 0.14,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

export const SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;
export const SPRING_SOFT = { damping: 22, stiffness: 140, mass: 1 } as const;
