import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { DayArt } from '../art/DayArt';
import { Hero } from '../art/Hero';
import { dayTotals, macroTargets, toUnit, weekdayIndex, type Entry, type Settings } from '../engine';
import { n, t } from '../i18n';
import { DAYS, INK_FAINT, INK_HAIR, INK_SOFT, MACRO, SHADOW, SHADOW_SM, SURFACE } from '../theme';
import { ChevronIcon } from '../ui/Icons';
import { Card } from '../ui/surface';
import { EASE_OUT, TIMING_SLOW } from '../ui/motion';
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

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const w = useSharedValue(0);
  const k = target > 0 ? Math.min(1, value / target) : 0;
  useEffect(() => {
    w.value = withTiming(k, { duration: 700, easing: EASE_OUT });
  }, [k, w]);
  const shown = useCountUp(value);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.macro}>
      <View style={styles.macroTop}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <T v="small" color={INK_SOFT} style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </T>
      </View>
      <T v="h2" style={{ marginTop: 3 }}>
        {n(shown)}
        <T v="small" color={INK_SOFT}>
          {' '}/ {n(target)}g
        </T>
      </T>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
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
}

export const DayPage = React.memo(function DayPage(p: DayPageProps) {
  const wd = weekdayIndex(p.day);
  const pal = DAYS[wd];
  const totals = dayTotals(p.entries);
  const targets = macroTargets(p.settings.goalKcal);
  const pending = p.entries.filter((e) => e.status === 'pending').length;
  const kcal = toUnit(totals.kcal, p.settings.unit);
  const goal = toUnit(p.settings.goalKcal, p.settings.unit);
  const shown = useCountUp(kcal);
  const diff = goal - kcal;
  const ringSize = Math.min(p.width * 0.64, (p.height - p.topInset - p.bottomReserve) * 0.4, 272);
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
            <Ring id={`r${wd}`} size={ringSize} progress={goal > 0 ? kcal / goal : 0} color={over ? MACRO.protein : pal.ring} colorSoft={over ? '#FFB3A8' : pal.ringSoft} track={INK_HAIR} />
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <T v="hero" style={{ fontSize: ringSize * 0.23, lineHeight: ringSize * 0.27 }} accessibilityLabel={`${n(kcal)} ${p.settings.unit}`}>
                {n(shown)}
              </T>
              <T v="small" color={INK_SOFT}>
                {t('of')} {n(goal)} {p.settings.unit}
              </T>
            </View>
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
        </View>
        <Card style={styles.card} tint={p.night ? SURFACE : 'rgba(255,255,255,0.94)'}>
          <MacroBar label={t('protein')} value={totals.protein} target={targets.protein} color={MACRO.protein} />
          <View style={styles.divider} />
          <MacroBar label={t('carbs')} value={totals.carbs} target={targets.carbs} color={MACRO.carbs} />
          <View style={styles.divider} />
          <MacroBar label={t('fat')} value={totals.fat} target={targets.fat} color={MACRO.fat} />
        </Card>
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
  card: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8, marginBottom: 14 },
  divider: { width: 1, backgroundColor: INK_FAINT, marginVertical: 6 },
  macro: { flex: 1, paddingHorizontal: 10 },
  macroTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: INK_HAIR, marginTop: 8, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.86)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
});
