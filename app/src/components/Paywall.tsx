import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Mascot } from '../art/Mascot';
import { locale, t } from '../i18n';
import { buy, loadPlans, perDay, restore, savingsPercent, type Plan } from '../iap';
import { useStore } from '../store';
import { BLUSH, INK, INK_FAINT, INK_SOFT, MACRO } from '../theme';
import { CheckIcon } from '../ui/Icons';
import { Pressy, T, haptic } from '../ui/kit';
import { Button } from '../ui/controls';
import { Sheet } from './Sheet';
import { LINKS } from '../links';

// One paywall for every context (end of onboarding, the daily limit,
// settings). Soft: "Maybe later" always works and the free tier keeps going.
// Prices, periods and the trial line come from the store, never constants.

function periodWord(p: Plan) {
  return p.period === 'year' ? t('year') : t('month');
}

function trialWord(p: Plan) {
  if (!p.trial) return '';
  if (p.trial.unit === 'week' && p.trial.value === 1) return t('oneWeek');
  if (p.trial.unit === 'day' && p.trial.value === 7) return t('oneWeek');
  return `${p.trial.value} ${p.trial.unit}`;
}

export function Paywall({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const isPro = useStore((s) => s.isPro);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [sel, setSel] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setThanks(false);
    let alive = true;
    void loadPlans().then((p) => {
      if (!alive) return;
      setPlans(p);
      setSel((cur) => cur || p.find((x) => x.period === 'year')?.id || p[0]?.id || '');
    });
    return () => {
      alive = false;
    };
  }, [visible]);

  useEffect(() => {
    if (visible && isPro && busy) setThanks(true);
  }, [isPro, visible, busy]);

  const yearly = plans?.find((p) => p.period === 'year');
  const monthly = plans?.find((p) => p.period === 'month');
  const chosen = plans?.find((p) => p.id === sel);
  const hasTrial = !!chosen?.trial;

  const purchase = async () => {
    if (!chosen) return;
    setBusy(true);
    const ok = await buy(chosen);
    setBusy(false);
    if (ok) {
      haptic('success');
      setThanks(true);
      setTimeout(onClose, 1400);
    }
  };

  const footer = (
    <View style={{ gap: 8 }}>
      <Button
        label={busy ? '…' : hasTrial ? t('pwCta') : t('pwCtaNoTrial')}
        onPress={() => void purchase()}
        disabled={!chosen || busy || thanks}
        testID="paywall-cta"
      />
      <T v="small" color={INK_SOFT} style={{ textAlign: 'center' }} testID="paywall-reassure">
        {hasTrial ? t('pwReassure') : t('pwReassureNoTrial')}
      </T>
      <View style={styles.links}>
        <Pressy onPress={onClose} hapticKind="none">
          <T v="label" color={INK_SOFT}>
            {t('pwLater')}
          </T>
        </Pressy>
        <Pressy
          onPress={async () => {
            setBusy(true);
            const ok = await restore();
            setBusy(false);
            if (ok) {
              setThanks(true);
              setTimeout(onClose, 1200);
            }
          }}
          hapticKind="none"
        >
          <T v="label" color={INK_SOFT}>
            {t('restore')}
          </T>
        </Pressy>
        <Pressy onPress={() => void Linking.openURL(LINKS.terms)} hapticKind="none">
          <T v="label" color={INK_SOFT}>
            {t('terms')}
          </T>
        </Pressy>
        <Pressy onPress={() => void Linking.openURL(LINKS.privacy)} hapticKind="none">
          <T v="label" color={INK_SOFT}>
            {t('privacy')}
          </T>
        </Pressy>
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} footer={footer} maxHeightRatio={0.94}>
      <View style={styles.hero}>
        <Mascot size={110} pose={thanks ? 'wow' : 'wave'} />
        <T v="title" style={styles.center}>
          {thanks ? t('pwThanks') : t('pwTitle')}
        </T>
        <T v="body" color={INK_SOFT} style={styles.center}>
          {t('pwBody')}
        </T>
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        {[t('pwFeature1'), t('pwFeature2'), t('pwFeature3'), t('pwFeature4')].map((f, i) => (
          <View key={i} style={styles.feature}>
            <View style={[styles.tick, { backgroundColor: [MACRO.protein, MACRO.carbs, MACRO.fat, BLUSH][i] }]}>
              <CheckIcon size={16} color={INK} />
            </View>
            <T v="body">{f}</T>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20, gap: 10 }}>
        {plans === null && <ActivityIndicator color={INK} style={{ marginVertical: 30 }} />}
        {plans !== null && plans.length === 0 && (
          <View style={styles.unavailable}>
            <T v="body" style={styles.center}>
              {t('pwUnavailable')}
            </T>
          </View>
        )}
        {[yearly, monthly].filter((p): p is Plan => !!p).map((p) => {
          const on = p.id === sel;
          return (
            <Animated.View key={p.id} entering={FadeIn}>
              <Pressy
                onPress={() => setSel(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.plan, on && styles.planOn]}
                scaleTo={0.98}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T v="h2">{p.period === 'year' ? t('pwYearly') : t('pwMonthly')}</T>
                    {p.period === 'year' && (
                      <View style={styles.badge}>
                        <T v="small" style={{ fontSize: 11 }}>
                          {t('pwBest')}
                          {monthly ? ` · ${t('pwSave', { n: savingsPercent(p, monthly) })}` : ''}
                        </T>
                      </View>
                    )}
                  </View>
                  <T v="small" color={INK_SOFT} testID={`plan-${p.period}-terms`}>
                    {p.trial ? t('pwTrial', { n: trialWord(p), price: p.displayPrice, period: periodWord(p) }) : t('pwNoTrial', { price: p.displayPrice, period: periodWord(p) })}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="h2">{t('pwPerDay', { p: perDay(p, locale) })}</T>
                  {p.period === 'year' && monthly ? (
                    <T v="small" color={INK_SOFT}>
                      {monthly.displayPrice}/{t('month')} → {perDay(p, locale)}
                    </T>
                  ) : null}
                </View>
              </Pressy>
            </Animated.View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginTop: 4 },
  center: { textAlign: 'center' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: INK },
  plan: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 22, borderWidth: 2.5, borderColor: INK_FAINT, backgroundColor: '#FFFFFF' },
  planOn: { borderColor: INK, backgroundColor: '#FFF1F5' },
  badge: { backgroundColor: MACRO.carbs, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  unavailable: { padding: 18, borderRadius: 20, backgroundColor: INK_FAINT },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
});
