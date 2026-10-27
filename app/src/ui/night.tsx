import { createContext, useContext } from 'react';
import { INK, INK_HAIR, INK_SOFT, NIGHT, SURFACE } from '../theme';

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
