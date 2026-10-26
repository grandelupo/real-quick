import { Easing, type WithTimingConfig } from 'react-native-reanimated';
import { DUR } from '../theme';

// Every animation in the app uses one of these: an ease-out that settles
// without overshoot. Springs are deliberately absent.

export const EASE_OUT = Easing.out(Easing.cubic);
export const EASE_IN_OUT = Easing.inOut(Easing.cubic);

export const TIMING: WithTimingConfig = { duration: DUR.base, easing: EASE_OUT };
export const TIMING_FAST: WithTimingConfig = { duration: DUR.fast, easing: EASE_OUT };
export const TIMING_SLOW: WithTimingConfig = { duration: DUR.slow, easing: EASE_OUT };
