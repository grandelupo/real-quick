import { createContext, useContext, useMemo } from 'react';
import { INK, INK_HAIR, INK_SOFT, NIGHT, PLUM, SURFACE, shadowOf, type ShadowSize } from '../theme';

// Whether the page is in its night look. Home provides it around the page
// (never around the sheets, which stay paper-white like system sheets);
// text and surfaces on the page read their colours from it.

export const NightContext = createContext(false);

export function useNight(): boolean {
  return useContext(NightContext);
}

export interface PageColors {
  ink: string;
  inkSoft: string;
  hair: string;
  surface: string;
  /** A surface that lets a little of the page through. */
  surfaceSoft: string;
}

const DAY_COLORS: PageColors = { ink: INK, inkSoft: INK_SOFT, hair: INK_HAIR, surface: SURFACE, surfaceSoft: 'rgba(255,255,255,0.88)' };
const NIGHT_COLORS: PageColors = { ink: NIGHT.ink, inkSoft: NIGHT.inkSoft, hair: NIGHT.hair, surface: NIGHT.surface, surfaceSoft: NIGHT.surfaceSoft };

/** The page's colours for the current look. */
export function usePageColors(): PageColors {
  return useContext(NightContext) ? NIGHT_COLORS : DAY_COLORS;
}

// What surfaces on this page cast. Home provides the day being viewed, so
// the chrome floating over the carousel (chips, capture bar, toasts) drops
// that page's colour. DayPage works its own out from its weekday instead —
// the carousel holds several at once and each has to cast its own. Sheets
// get no provider at all: plum on paper.

export const ShadeContext = createContext(PLUM);

export function useShade(): string {
  return useContext(ShadeContext);
}

/** The page's shadow, in the page's own colour. */
export function useShadow(size: ShadowSize = 'lg') {
  const shade = useShade();
  return useMemo(() => shadowOf(shade, size), [shade, size]);
}
