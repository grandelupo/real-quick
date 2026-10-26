import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Share as RNShare, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { DayArt } from '../art/DayArt';
import { Hero } from '../art/Hero';
import { dayMood, dayTotals, macroTargets, toUnit, weekdayIndex, type Entry, type Settings } from '../engine';
import { n, t } from '../i18n';
import { DAYS, INK_SOFT, MACRO } from '../theme';
import { T } from '../ui/kit';

// "Show your partner how you're doing": a pastel card image of the day plus
// one friendly line, through the system share sheet (Messages, WhatsApp…).
// No accounts, no server — it is just a picture you send.

const W = 360;
const H = 450;

export interface ShareHandle {
  share(day: string, label: string, entries: Entry[], settings: Settings): Promise<void>;
}

interface CardData {
  day: string;
  label: string;
  entries: Entry[];
  settings: Settings;
}

function Card({ d }: { d: CardData }) {
  const totals = dayTotals(d.entries);
  const targets = macroTargets(d.settings.goalKcal);
  const wd = weekdayIndex(d.day);
  const mood = dayMood(totals.kcal, d.settings.goalKcal);
  const kcal = toUnit(totals.kcal, d.settings.unit);
  const goal = toUnit(d.settings.goalKcal, d.settings.unit);
  return (
    <View style={styles.card}>
      <DayArt weekday={wd} width={W} height={H} night={false} />
      <View style={styles.inner}>
        <T v="h2">{d.label}</T>
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <Hero kind={DAYS[wd].hero} size={120} />
          <T v="hero" style={{ fontSize: 58, lineHeight: 64, marginTop: 2 }}>
            {n(kcal)}
          </T>
          <T v="label" color={INK_SOFT}>
            {t('of')} {n(goal)} {d.settings.unit}
          </T>
          <T v="h2" style={{ marginTop: 10, textAlign: 'center' }}>
            {t(`shareMood.${mood}`)}
          </T>
        </View>
        <View style={styles.macros}>
          {(
            [
              ['protein', totals.protein, targets.protein, MACRO.protein],
              ['carbs', totals.carbs, targets.carbs, MACRO.carbs],
              ['fat', totals.fat, targets.fat, MACRO.fat],
            ] as const
          ).map(([k, v, tg, c]) => (
            <View key={k} style={styles.macro}>
              <View style={[styles.dot, { backgroundColor: c }]} />
              <T v="label">
                {n(v)}
                <T v="small" color={INK_SOFT}>{`/${n(tg)}g`}</T>
              </T>
            </View>
          ))}
        </View>
        <T v="small" color={INK_SOFT} style={{ textAlign: 'center', marginTop: 'auto' }}>
          Real Quick
        </T>
      </View>
    </View>
  );
}

export const ShareCardHost = forwardRef<ShareHandle>(function ShareCardHost(_, ref) {
  const [data, setData] = useState<CardData | null>(null);
  const view = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    async share(day, label, entries, settings) {
      const totals = dayTotals(entries);
      const mood = dayMood(totals.kcal, settings.goalKcal);
      const message = t('shareText', {
        hi: settings.partnerName.trim() ? t('shareHi', { name: settings.partnerName.trim() }) : '',
        kcal: n(toUnit(totals.kcal, settings.unit)),
        goal: n(toUnit(settings.goalKcal, settings.unit)),
        unit: settings.unit,
        mood: t(`shareMood.${mood}`),
      });
      if (Platform.OS === 'web') {
        await RNShare.share({ message, title: t('shareTitle') }).catch(() => undefined);
        return;
      }
      setData({ day, label, entries, settings });
      // Let the card render before we photograph it.
      await new Promise((r) => setTimeout(r, 120));
      try {
        const uri = await captureRef(view, { format: 'png', quality: 1, width: W * 3, height: H * 3 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: message, UTI: 'public.png' });
        } else {
          await RNShare.share({ message });
        }
      } catch {
        await RNShare.share({ message, title: t('shareTitle') }).catch(() => undefined);
      } finally {
        setData(null);
      }
    },
  }));

  if (!data) return null;
  return (
    <View style={styles.offscreen} pointerEvents="none">
      <View ref={view} collapsable={false}>
        <Card d={data} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -W * 2, top: 0 },
  card: { width: W, height: H, borderRadius: 32, overflow: 'hidden' },
  inner: { flex: 1, padding: 24 },
  macros: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 12 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
