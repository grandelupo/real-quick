import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { dayKey, dayTotals, toUnit, type Entry, type Settings } from '../engine';
import { entriesFor } from '../store';
import { locale, n, t } from '../i18n';
import { INK, INK_HAIR, INK_SOFT, MACRO, SURFACE } from '../theme';
import { ChevronIcon } from '../ui/Icons';
import { Pressy, T } from '../ui/kit';
import { Sheet } from './Sheet';

// Tap the date and the month opens: every day with what it came to, today
// marked, the day on screen outlined. Tap a day to jump to it. Weeks start
// on Monday, like the weekday palettes.

function ym(key: string): [number, number] {
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1];
}

export function MonthSheet({ visible, onClose, viewing, today, firstDay, entries, settings, onPick }: { visible: boolean; onClose(): void; viewing: string; today: string; firstDay: string; entries: Entry[]; settings: Settings; onPick(day: string): void }) {
  const [cursor, setCursor] = useState<[number, number]>(() => ym(viewing));
  const [year, month] = cursor;
  const [minY, minM] = ym(firstDay);
  const [maxY, maxM] = ym(today);
  const canPrev = year > minY || (year === minY && month > minM);
  const canNext = year < maxY || (year === maxY && month < maxM);

  // reset to the viewed month each time the sheet opens
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (visible && openedFor !== viewing) {
    setOpenedFor(viewing);
    setCursor(ym(viewing));
  }
  if (!visible && openedFor !== null) setOpenedFor(null);

  const weekdays = useMemo(() => {
    const base = new Date(2024, 0, 1); // a Monday
    return Array.from({ length: 7 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i).toLocaleDateString(locale, { weekday: 'narrow' }));
  }, []);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const out: ({ key: string; day: number; kcal: number; goal: number; state: 'past' | 'today' | 'none' | 'future' } | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= count; d++) {
      const key = dayKey(new Date(year, month, d));
      const state = key > today ? 'future' : key < firstDay ? 'none' : key === today ? 'today' : 'past';
      const totals = state === 'future' || state === 'none' ? null : dayTotals(entriesFor(key, entries));
      out.push({ key, day: d, kcal: totals ? toUnit(totals.kcal, settings.unit) : 0, goal: toUnit(settings.goalKcal, settings.unit), state });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [year, month, today, firstDay, entries, settings.unit, settings.goalKcal]);

  const label = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <Sheet visible={visible} onClose={onClose} maxHeightRatio={0.8}>
      <View style={styles.head}>
        <Pressy onPress={() => canPrev && setCursor(month === 0 ? [year - 1, 11] : [year, month - 1])} disabled={!canPrev} style={[styles.nav, !canPrev && { opacity: 0.3 }]} accessibilityLabel={t('monthPrev')}>
          <ChevronIcon size={18} dir="left" color={INK} />
        </Pressy>
        <T v="h2" style={{ textTransform: 'capitalize' }} accessibilityRole="header">
          {label}
        </T>
        <Pressy onPress={() => canNext && setCursor(month === 11 ? [year + 1, 0] : [year, month + 1])} disabled={!canNext} style={[styles.nav, !canNext && { opacity: 0.3 }]} accessibilityLabel={t('monthNext')}>
          <ChevronIcon size={18} dir="right" color={INK} />
        </Pressy>
      </View>
      <View style={styles.row}>
        {weekdays.map((w, i) => (
          <T key={i} v="small" color={INK_SOFT} style={styles.weekday}>
            {w}
          </T>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((c, i) =>
          c === null ? (
            <View key={`e${i}`} style={styles.cell} />
          ) : (
            <Pressy
              key={c.key}
              onPress={() => onPick(c.key)}
              disabled={c.state === 'future' || c.state === 'none'}
              style={[styles.cell, c.key === viewing && styles.cellViewing]}
              scaleTo={0.94}
              hapticKind="light"
              accessibilityLabel={`${c.key} ${c.kcal ? n(c.kcal) : ''}`}
            >
              <View style={[styles.num, c.state === 'today' && styles.numToday]}>
                <T v="label" color={c.state === 'today' ? SURFACE : c.state === 'future' || c.state === 'none' ? INK_HAIR : INK}>
                  {c.day}
                </T>
              </View>
              {c.state === 'past' || c.state === 'today' ? (
                <T v="small" color={c.kcal > c.goal * 1.05 ? MACRO.protein : INK_SOFT} style={{ fontSize: 10, lineHeight: 12 }} numberOfLines={1}>
                  {c.kcal > 0 ? n(c.kcal) : '·'}
                </T>
              ) : (
                <T v="small" style={{ fontSize: 10, lineHeight: 12 }}>
                  {' '}
                </T>
              )}
            </Pressy>
          ),
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nav: { width: 40, height: 40, borderRadius: 20, backgroundColor: INK_HAIR, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6, borderRadius: 14, gap: 2 },
  cellViewing: { backgroundColor: INK_HAIR },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numToday: { backgroundColor: INK },
});
