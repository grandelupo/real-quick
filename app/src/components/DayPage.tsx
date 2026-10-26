import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { DayArt } from '../art/DayArt';
import { dayTotals, macroTargets, toUnit, weekdayIndex, type Entry, type Settings } from '../engine';
import { n, t } from '../i18n';
import { DAYS, FONT, INK_FAINT, INK_SOFT, MACRO, SHADOW } from '../theme';
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

function Ring({ size, progress, color, track }: { size: number; progress: number; color: string; track: string }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(Math.min(progress, 1), { damping: 20, stiffness: 90 });
  }, [progress, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="rgba(255,255,255,0.55)" />
      <ACircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${c} ${c}`}
        animatedProps={props}
      />
    </Svg>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const w = useSharedValue(0);
  const k = target > 0 ? Math.min(1, value / target) : 0;
  useEffect(() => {
    w.value = withTiming(k, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [k, w]);
  const shown = useCountUp(value);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.macro}>
      <View style={styles.macroTop}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <T v="label" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </T>
      </View>
      <T v="h2" style={{ marginTop: 2 }}>
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
  hint?: string;
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
  const ringSize = Math.min(p.width * 0.66, (p.height - p.topInset - p.bottomReserve) * 0.42, 280);

  return (
    <View style={{ width: p.width, height: p.height }}>
      <DayArt weekday={wd} width={p.width} height={p.height} night={p.night} active={p.active} />
      <View style={[styles.content, { paddingTop: p.topInset + 8, paddingBottom: p.bottomReserve }]}>
        <T v="title" style={styles.date} numberOfLines={1} accessibilityRole="header">
          {p.label}
        </T>
        <View style={styles.middle}>
          <View style={[styles.ringWrap, { width: ringSize, height: ringSize }]}>
            <Ring size={ringSize} progress={goal > 0 ? kcal / goal : 0} color={kcal > goal * 1.05 ? MACRO.protein : pal.ring} track={p.night ? INK_FAINT : 'rgba(255,255,255,0.7)'} />
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <T v="hero" style={{ fontSize: ringSize * 0.25, lineHeight: ringSize * 0.29 }} accessibilityLabel={`${n(kcal)} ${p.settings.unit}`}>
                {n(shown)}
              </T>
              <T v="label" color={INK_SOFT}>
                {t('of')} {n(goal)} {p.settings.unit}
              </T>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: p.night ? '#FFFFFF' : 'rgba(255,255,255,0.75)' }]}>
            <T v="label">{diff >= 0 ? t('left', { n: n(diff) }) : t('over', { n: n(-diff) })}</T>
          </View>
          {pending > 0 && (
            <Animated.View entering={FadeIn} style={[styles.pending]}>
              <T v="small" color={INK_SOFT}>
                {t('pending', { n: pending })}
              </T>
            </Animated.View>
          )}
        </View>
        <View style={[styles.card, SHADOW, { backgroundColor: p.night ? '#FFFFFF' : 'rgba(255,255,255,0.94)' }]}>
          <MacroBar label={t('protein')} value={totals.protein} target={targets.protein} color={MACRO.protein} />
          <MacroBar label={t('carbs')} value={totals.carbs} target={targets.carbs} color={MACRO.carbs} />
          <MacroBar label={t('fat')} value={totals.fat} target={targets.fat} color={MACRO.fat} />
        </View>
        {p.hint ? (
          <T v="small" color={INK_SOFT} style={styles.hint}>
            {p.hint}
          </T>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 22 },
  date: { paddingRight: 110, minHeight: 40 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  pending: { marginTop: 8 },
  card: { flexDirection: 'row', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 10, marginBottom: 14, gap: 4 },
  macro: { flex: 1, paddingHorizontal: 6 },
  macroTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  track: { height: 7, borderRadius: 4, backgroundColor: INK_FAINT, marginTop: 8, overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
  hint: { textAlign: 'center', marginBottom: 8, fontFamily: FONT.body, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
});

