import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { DayArt } from '../art/DayArt';
import { Hero } from '../art/Hero';
import { MascotIntro } from './MascotIntro';
import { dayTotals, toUnit, weekdayIndex, type Entry, type Settings } from '../engine';
import { n, t } from '../i18n';
import { DAYS, INK_HAIR, INK_SOFT, MACRO, SHADOW, SHADOW_SM, SURFACE } from '../theme';
import { ChevronIcon } from '../ui/Icons';
import { EASE_OUT } from '../ui/motion';
import { T } from '../ui/kit';

const ACircle = Animated.createAnimatedComponent(Circle);

/** Smooth count-up for the hero number — nothing on screen teleports. */
export function useCountUp(target: number, ms = 650): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (target - start) * eased;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/**
 * The progress ring, drawn as a soft tube: a faint inset track, a gradient
 * arc from the day's light tone to its strong one, and a thin highlight
 * along the arc so it reads as a rounded solid rather than a flat line.
 */
function Ring({ size, progress, color, colorSoft, track, id }: { size: number; progress: number; color: string; colorSoft: string; track: string; id: string }) {
  const stroke = size * 0.075;
  const r = (size - stroke) / 2 - size * 0.04;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.min(progress, 1), { duration: 900, easing: EASE_OUT });
  }, [progress, p]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  const highlight = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value), opacity: p.value > 0.01 ? 0.35 : 0 }));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <LinearGradient id={`${id}-arc`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colorSoft} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r + stroke * 0.42} stroke="rgba(43,35,80,0.045)" strokeWidth={1.5} fill="none" />
      <ACircle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id}-arc)`} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={`${c} ${c}`} animatedProps={arc} />
      <ACircle cx={size / 2} cy={size / 2} r={r + stroke * 0.22} stroke="#FFFFFF" strokeWidth={stroke * 0.22} strokeLinecap="round" fill="none" strokeDasharray={`${c} ${c}`} animatedProps={highlight} />
    </Svg>
  );
}

export interface DayPageProps {
  day: string;
  label: string;
  width: number;
  height: number;
  active: boolean;
  night: boolean;
  entries: Entry[];
  settings: Settings;
  topInset: number;
  bottomReserve: number;
  hint?: { text: string; dir: 'up' | 'left' };
  /** A quiet line under the ring, e.g. how many free days are left. */
  note?: string;
  /** First open of the day: the mascot sits in the disc and gets eaten before the ring appears. */
  intro?: boolean;
  onIntroDone?(): void;
}

export const DayPage = React.memo(function DayPage(p: DayPageProps) {
  const [intro, setIntro] = useState(!!p.intro);
  const wd = weekdayIndex(p.day);
  const pal = DAYS[wd];
  const totals = dayTotals(p.entries);
  const pending = p.entries.filter((e) => e.status === 'pending').length;
  const kcal = toUnit(totals.kcal, p.settings.unit);
  const goal = toUnit(p.settings.goalKcal, p.settings.unit);
  const shown = useCountUp(kcal);
  const diff = goal - kcal;
  const ringSize = Math.min(p.width * 0.6, (p.height - p.topInset - p.bottomReserve) * 0.5, 256);
  const heroSize = Math.min(p.width * 0.34, 140);
  const over = kcal > goal * 1.05;

  return (
    <View style={{ width: p.width, height: p.height }}>
      <DayArt weekday={wd} width={p.width} height={p.height} night={p.night} />
      {/* the day's object, tucked behind the ring's disc */}
      <View style={[styles.hero, { top: p.topInset + 52 }]} pointerEvents="none">
        <Hero kind={pal.hero} size={heroSize} opacity={p.night ? 0.9 : 1} />
      </View>
      <View style={[styles.content, { paddingTop: p.topInset + 8, paddingBottom: p.bottomReserve }]}>
        <T v="title" style={styles.date} numberOfLines={1} accessibilityRole="header">
          {p.label}
        </T>
        <View style={styles.middle}>
          <View style={[styles.disc, SHADOW, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, backgroundColor: p.night ? SURFACE : 'rgba(255,255,255,0.92)' }]}>
            {intro ? (
              <MascotIntro
                size={ringSize * 0.84}
                active={p.active}
                onDone={() => {
                  setIntro(false);
                  p.onIntroDone?.();
                }}
              />
            ) : (
              <>
                <Ring id={`r${wd}`} size={ringSize} progress={goal > 0 ? kcal / goal : 0} color={over ? MACRO.protein : pal.ring} colorSoft={over ? '#FFB3A8' : pal.ringSoft} track={INK_HAIR} />
                <Animated.View entering={p.intro ? FadeIn.duration(500) : undefined} style={[StyleSheet.absoluteFill, styles.center]}>
                  <T v="hero" style={{ fontSize: ringSize * 0.23, lineHeight: ringSize * 0.27 }} accessibilityLabel={`${n(kcal)} ${p.settings.unit}`}>
                    {n(shown)}
                  </T>
                  <T v="small" color={INK_SOFT}>
                    {t('of')} {n(goal)} {p.settings.unit}
                  </T>
                </Animated.View>
              </>
            )}
          </View>
          <View style={[styles.pill, SHADOW_SM, { backgroundColor: p.night ? SURFACE : 'rgba(255,255,255,0.86)' }]}>
            <T v="label">{diff >= 0 ? t('left', { n: n(diff) }) : t('over', { n: n(-diff) })}</T>
          </View>
          {pending > 0 && (
            <Animated.View entering={FadeIn} style={styles.pending}>
              <T v="small" color={INK_SOFT}>
                {t('pending', { n: pending })}
              </T>
            </Animated.View>
          )}
          {p.note ? (
            <T v="small" color={INK_SOFT} style={styles.pending}>
              {p.note}
            </T>
          ) : null}
        </View>
        {p.hint ? (
          <Animated.View key={p.hint.dir} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={[styles.hint, SHADOW_SM]}>
            <ChevronIcon size={16} dir={p.hint.dir} color={INK_SOFT} />
            <T v="small" color={INK_SOFT}>
              {p.hint.text}
            </T>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 22 },
  date: { paddingRight: 110, minHeight: 40 },
  hero: { position: 'absolute', right: 14 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  pending: { marginTop: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
});
