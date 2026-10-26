import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '../i18n';
import { n } from '../i18n';
import { INK_HAIR, INK_SOFT, MACRO, SHADOW_SM, SURFACE } from '../theme';
import { EASE_OUT } from '../ui/motion';
import { T } from '../ui/kit';
import { useCountUp } from './DayPage';

// Three small chips above the capture bar: protein, carbs, fat against their
// targets. Compact on purpose — the forest lives behind them.

function Chip({ label, value, target, color, night }: { label: string; value: number; target: number; color: string; night: boolean }) {
  const w = useSharedValue(0);
  const k = target > 0 ? Math.min(1, value / target) : 0;
  useEffect(() => {
    w.value = withTiming(k, { duration: 700, easing: EASE_OUT });
  }, [k, w]);
  const shown = useCountUp(value);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={[styles.chip, SHADOW_SM, { backgroundColor: night ? SURFACE : 'rgba(255,255,255,0.9)' }]}>
      <View style={styles.top}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <T v="small" color={INK_SOFT} numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </T>
      </View>
      <T v="label" style={{ marginTop: 1 }}>
        {n(shown)}
        <T v="small" color={INK_SOFT}>
          {' '}/ {n(target)}g
        </T>
      </T>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      </View>
    </View>
  );
}

export function MacroStrip({ totals, targets, night }: { totals: { protein: number; carbs: number; fat: number }; targets: { protein: number; carbs: number; fat: number }; night: boolean }) {
  return (
    <View style={styles.row}>
      <Chip label={t('protein')} value={totals.protein} target={targets.protein} color={MACRO.protein} night={night} />
      <Chip label={t('carbs')} value={totals.carbs} target={targets.carbs} color={MACRO.carbs} night={night} />
      <Chip label={t('fat')} value={totals.fat} target={targets.fat} color={MACRO.fat} night={night} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  chip: { flex: 1, borderRadius: 16, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  track: { height: 4, borderRadius: 2, backgroundColor: INK_HAIR, marginTop: 6, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
