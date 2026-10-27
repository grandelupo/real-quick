import React, { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { GOAL_MAX, GOAL_MIN, GOAL_STEP, dayKey, freeDaysLeft, toUnit, type Bias, type Profile } from '../engine';
import { n, t } from '../i18n';
import { manageSubscriptions, restore } from '../iap';
import { LINKS } from '../links';
import { deleteAllPhotos } from '../photos';
import { eraseAll, setSettings, useStore } from '../store';
import { BLUSH, INK, INK_FAINT, INK_SOFT } from '../theme';
import { Pressy, T } from '../ui/kit';
import { Button, SectionTitle, Segmented, Stepper, ToggleRow } from '../ui/controls';
import { GoalCalculator } from './GoalCalculator';
import { Sheet } from './Sheet';

// The cog sheet: the handful of things worth tuning, plus the plumbing App
// Review expects (plan status, restore, manage, legal, version line).

export function SettingsSheet({ visible, onClose, onPaywall, onShare }: { visible: boolean; onClose(): void; onPaywall(): void; onShare(): void }) {
  const settings = useStore((s) => s.settings);
  const isPro = useStore((s) => s.isPro);
  const share = useStore((s) => s.share);
  const firstDay = useStore((s) => s.firstDay);
  const daysLeft = freeDaysLeft(firstDay, dayKey(new Date()));
  const [calc, setCalc] = useState(false);
  const [calcGoal, setCalcGoal] = useState<{ goal: number; profile: Profile } | null>(null);
  const version = `v${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '1'})`;

  const confirmErase = () => {
    const run = () => {
      deleteAllPhotos();
      void eraseAll();
      onClose();
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(t('eraseConfirm'))) run();
      return;
    }
    Alert.alert(t('eraseAll'), t('eraseConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('erase'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Sheet visible={visible} onClose={() => { setCalc(false); onClose(); }}>
      <View style={styles.head}>
        <T v="title" style={{ flex: 1 }} accessibilityRole="header">
          {t('settings')}
        </T>
        <Pressy onPress={() => { setCalc(false); onClose(); }} style={styles.done}>
          <T v="label">{t('done')}</T>
        </Pressy>
      </View>

      <SectionTitle>{t('dailyGoal')}</SectionTitle>
      {calc ? (
        <>
          <GoalCalculator
            initial={settings.profile}
            imperial={settings.imperial}
            unit={settings.unit}
            onImperial={(imperial) => setSettings({ imperial })}
            onChange={(goal, profile) => setCalcGoal({ goal, profile })}
          />
          <View style={{ height: 14 }} />
          <Button
            label={t('save')}
            onPress={() => {
              if (calcGoal) setSettings({ goalKcal: calcGoal.goal, profile: calcGoal.profile });
              setCalc(false);
            }}
          />
        </>
      ) : (
        <>
          <Stepper
            value={settings.goalKcal}
            step={GOAL_STEP}
            min={GOAL_MIN}
            max={GOAL_MAX}
            onChange={(goalKcal) => setSettings({ goalKcal })}
            format={(v) => `${n(toUnit(v, settings.unit))} ${settings.unit}`}
          />
          <Pressy onPress={() => setCalc(true)} style={styles.link} hapticKind="light">
            <T v="label" color={INK_SOFT}>
              {t('recalc')} →
            </T>
          </Pressy>
        </>
      )}

      <SectionTitle>{t('estimates')}</SectionTitle>
      <Segmented<Bias>
        testID="bias-picker"
        value={settings.bias}
        onChange={(bias) => setSettings({ bias })}
        options={[
          { value: 'under', label: t('biasUnder'), sub: t('biasUnderSub') },
          { value: 'honest', label: t('biasHonest'), sub: t('biasHonestSub') },
          { value: 'over', label: t('biasOver'), sub: t('biasOverSub') },
        ]}
      />
      <T v="small" color={INK_SOFT} style={{ marginTop: 8 }}>
        {t('biasExplain')}
      </T>

      <SectionTitle>{t('units')}</SectionTitle>
      <Segmented
        value={settings.unit}
        onChange={(unit) => setSettings({ unit })}
        options={[
          { value: 'kcal', label: 'kcal' },
          { value: 'kJ', label: 'kJ' },
        ]}
      />

      <SectionTitle>{t('sharing')}</SectionTitle>
      <T v="small" color={INK_SOFT}>
        {share ? t('shareOn') : t('shareOff')}
      </T>
      <Pressy onPress={onShare} style={styles.link} hapticKind="light">
        <T v="label" color={INK_SOFT}>
          {t('shareManage')}
        </T>
      </Pressy>

      <View style={{ height: 12 }} />
      <ToggleRow label={t('nightLook')} value={settings.nightLook} onChange={(nightLook) => setSettings({ nightLook })} />
      <ToggleRow label={t('haptics')} value={settings.haptics} onChange={(haptics) => setSettings({ haptics })} />

      <SectionTitle>{t('widgets')}</SectionTitle>
      <T v="small" color={INK_SOFT}>
        {Platform.OS === 'android' ? t('widgetsHowAndroid') : t('widgetsHowIOS')}
      </T>

      <SectionTitle>{t('pro')}</SectionTitle>
      <View style={styles.pro}>
        <View style={[styles.proBadge, isPro && { backgroundColor: BLUSH }]}>
          <T v="small" style={{ fontSize: 11, letterSpacing: 1 }} color={isPro ? INK : INK_SOFT}>
            PRO
          </T>
        </View>
        <T v="body" style={{ flex: 1 }}>
          {isPro ? t('proActive') : `${t('proFree')} ${daysLeft > 0 ? t('trialDaysLeft', { n: daysLeft }) : ''}`.trim()}
        </T>
      </View>
      {!isPro && <Button label={t('upgrade')} onPress={onPaywall} />}
      <View style={styles.rowLinks}>
        <Pressy onPress={() => void restore()} hapticKind="light">
          <T v="label" color={INK_SOFT}>
            {t('restore')}
          </T>
        </Pressy>
        <Pressy onPress={() => void manageSubscriptions()} hapticKind="light">
          <T v="label" color={INK_SOFT}>
            {t('manage')}
          </T>
        </Pressy>
      </View>

      <View style={[styles.rowLinks, { marginTop: 18 }]}>
        <Pressy onPress={() => void Linking.openURL(LINKS.privacy)}>
          <T v="label" color={INK_SOFT}>
            {t('privacy')}
          </T>
        </Pressy>
        <Pressy onPress={() => void Linking.openURL(LINKS.terms)}>
          <T v="label" color={INK_SOFT}>
            {t('terms')}
          </T>
        </Pressy>
        <Pressy onPress={() => void Linking.openURL(LINKS.support)}>
          <T v="label" color={INK_SOFT}>
            {t('support')}
          </T>
        </Pressy>
      </View>

      <View style={{ height: 20 }} />
      <Button label={t('eraseAll')} kind="danger" onPress={confirmErase} />
      <T v="small" color={INK_SOFT} selectable style={styles.version}>
        Real Quick {version}
      </T>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  done: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: INK_FAINT },
  link: { paddingVertical: 12 },
  pro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  proBadge: { paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: INK_FAINT, alignItems: 'center', justifyContent: 'center' },
  rowLinks: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  version: { textAlign: 'center', marginTop: 18, opacity: 0.7 },
});
