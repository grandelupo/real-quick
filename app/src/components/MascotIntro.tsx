import React, { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Image as SvgImage, Mask, Rect } from 'react-native-svg';
import { EASE_OUT } from '../ui/motion';
import { haptic } from '../ui/kit';

// The first time the app opens on a day, the pie mascot from the icon sits
// in the ring's disc, winks, and is eaten in a few quick bites before the
// ring and the numbers take its place. Bites are cut by an SVG mask —
// circles at the rim, then one that covers the rest — and each one nudges
// the pie a little, ease-out, so it reads as a chomp and not as a wobble.

const PIE = require('../../assets/art/mascot.png');
const WINK = require('../../assets/art/mascot-wink.png');

/** Bites around the rim: angle (deg), distance of the centre from the pie's centre, radius — in units of the size. */
const BITES: [number, number, number][] = [
  [205, 0.58, 0.33],
  [330, 0.56, 0.34],
  [95, 0.58, 0.32],
  [20, 0.5, 0.36],
  [150, 0.46, 0.4],
  [270, 0.38, 0.46],
];

const HOLD = 900;
const WINK_AT = HOLD;
const WINK_FOR = 220;
const BITES_AT = WINK_AT + WINK_FOR + 380;
const BITE_EVERY = 135;
const GONE_AT = BITES_AT + BITES.length * BITE_EVERY;
const DONE_AT = GONE_AT + 180;

export function MascotIntro({ size, active, onDone }: { size: number; active: boolean; onDone(): void }) {
  const [wink, setWink] = useState(false);
  const [bites, setBites] = useState(0);
  const [gone, setGone] = useState(false);
  const started = useRef(false);
  const nudgeX = useSharedValue(0);
  const nudgeY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    at(WINK_AT, () => setWink(true));
    at(WINK_AT + WINK_FOR, () => setWink(false));
    BITES.forEach(([deg], i) => {
      at(BITES_AT + i * BITE_EVERY, () => {
        setBites(i + 1);
        haptic('light');
        // pushed away from the bite, then settling back
        const a = (deg * Math.PI) / 180;
        const k = size * 0.025;
        nudgeX.value = withSequence(withTiming(-Math.cos(a) * k, { duration: 40 }), withTiming(0, { duration: 160, easing: EASE_OUT }));
        nudgeY.value = withSequence(withTiming(-Math.sin(a) * k, { duration: 40 }), withTiming(0, { duration: 160, easing: EASE_OUT }));
      });
    });
    at(GONE_AT, () => {
      setGone(true);
      scale.value = withTiming(0.6, { duration: 150, easing: EASE_OUT });
    });
    at(DONE_AT, onDone);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: gone ? 0 : 1,
    transform: [{ translateX: nudgeX.value }, { translateY: nudgeY.value }, { scale: scale.value }],
  }));

  const c = size / 2;
  return (
    <Animated.View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <Mask id="bites" maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
            <Rect x={0} y={0} width={size} height={size} fill="#fff" />
            {BITES.slice(0, bites).map(([deg, dist, r], i) => {
              const a = (deg * Math.PI) / 180;
              return <Circle key={i} cx={c + Math.cos(a) * dist * size} cy={c + Math.sin(a) * dist * size} r={r * size} fill="#000" />;
            })}
          </Mask>
        </Defs>
        <SvgImage href={wink ? WINK : PIE} x={0} y={0} width={size} height={size} preserveAspectRatio="xMidYMid meet" mask="url(#bites)" />
      </Svg>
    </Animated.View>
  );
}
