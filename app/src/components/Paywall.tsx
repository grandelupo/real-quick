import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Hero } from '../art/Hero';
import { ApiError, redeemCoupon } from '../api';
import { dayKey, freeDaysLeft } from '../engine';
import { locale, t } from '../i18n';
import { buy, loadPlans, restore, type Plan } from '../iap';
import { setState, useStore } from '../store';
import { BLUSH, FONT, INK, INK_FAINT, INK_HAIR, INK_SOFT, MACRO, SHADOW_SM, SURFACE } from '../theme';
import { CheckIcon } from '../ui/Icons';
import { Pressy, T, haptic } from '../ui/kit';
import { Sheet } from './Sheet';
import { LINKS } from '../links';

// One paywall for every context (end of onboarding, the free days running
// out, settings). Plain on purpose: two plans, each a button that says what
// it costs and how often, one sentence on renewal, the links App Review
// expects, and nothing derived — no per-day arithmetic, no badges, no timers.
// Prices and periods come from the store, never constants.

function periodWord(p: Plan) {
  return p.period === 'year' ? t('year') : t('month');
}

export function Paywall({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const isPro = useStore((s) => s.isPro);
  const firstDay = useStore((s) => s.firstDay);
  const locked = !isPro && freeDaysLeft(firstDay, dayKey(new Date())) === 0;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponNote, setCouponNote] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setThanks(false);
    setCouponOpen(false);
    setCouponNote(null);
    let alive = true;
    void loadPlans().then((p) => alive && setPlans(p));
    return () => {
      alive = false;
    };
  }, [visible]);

  const done = () => {
    haptic('success');
    setThanks(true);
    setTimeout(onClose, 1400);
  };

  const purchase = async (plan: Plan) => {
    setBusy(plan.id);
    const ok = await buy(plan);
    setBusy(null);
    if (ok) done();
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setBusy('coupon');
    try {
      const until = await redeemCoupon(coupon);
      setState({ isPro: true, proUntil: until });
      setCouponNote(t('pwCouponOk', { d: new Date(`${until}T12:00:00`).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) }));
      done();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'network';
      setCouponNote(code === 'bad_coupon' ? t('pwCouponBad') : t('pwCouponNet'));
      haptic('warning');
    } finally {
      setBusy(null);
    }
  };

  const monthly = plans?.find((p) => p.period === 'month');
  const yearly = plans?.find((p) => p.period === 'year');
  const ordered = [monthly, yearly].filter((p): p is Plan => !!p);
  const renewKey = Platform.OS === 'android' ? 'pwRenewsAndroid' : 'pwRenews';

  const footer = (
    <View style={{ gap: 10 }}>
      {monthly && yearly ? (
        <T v="small" color={INK_SOFT} style={styles.center} testID="paywall-terms">
          {t(renewKey, { monthly: monthly.displayPrice, yearly: yearly.displayPrice })}
        </T>
      ) : null}
      <View style={styles.links}>
        <Pressy onPress={onClose} hapticKind="none">
          <T v="label" color={INK_SOFT}>
            {t('pwLater')}
          </T>
        </Pressy>
        <Pressy
          onPress={async () => {
            setBusy('restore');
            const ok = await restore();
            setBusy(null);
            if (ok) done();
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
      {couponOpen ? (
        <View style={styles.couponRow}>
          <TextInput
            value={coupon}
            onChangeText={(v) => {
              setCoupon(v.toUpperCase());
              setCouponNote(null);
            }}
            placeholder={t('pwCouponTitle')}
            placeholderTextColor={INK_SOFT}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void applyCoupon()}
            style={styles.couponInput}
            testID="coupon-input"
          />
          <Pressy onPress={() => void applyCoupon()} disabled={!coupon.trim() || busy === 'coupon'} style={[styles.couponBtn, (!coupon.trim() || busy === 'coupon') && { opacity: 0.45 }]} hapticKind="light">
            <T v="label">{busy === 'coupon' ? '…' : t('pwCouponApply')}</T>
          </Pressy>
        </View>
      ) : (
        <Pressy onPress={() => setCouponOpen(true)} hapticKind="none" style={{ alignSelf: 'center', paddingVertical: 4 }} testID="coupon-link">
          <T v="small" color={INK_SOFT}>
            {t('pwCoupon')}
          </T>
        </Pressy>
      )}
      {couponNote ? (
        <T v="small" color={INK_SOFT} style={styles.center}>
          {couponNote}
        </T>
      ) : null}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} footer={footer} maxHeightRatio={0.94}>
      <View style={styles.hero}>
        <Hero kind="camera" size={110} />
        <T v="title" style={styles.center}>
          {thanks ? t('pwThanks') : locked ? t('pwTitleLocked') : t('pwTitle')}
        </T>
        <T v="body" color={INK_SOFT} style={styles.center}>
          {t('pwBody')}
        </T>
      </View>

      <View style={{ gap: 10, marginTop: 16 }}>
        {[t('pwFeature1'), t('pwFeature2'), t('pwFeature3'), t('pwFeature4')].map((f, i) => (
          <View key={i} style={styles.feature}>
            <View style={[styles.tick, { backgroundColor: `${[MACRO.protein, MACRO.carbs, MACRO.fat, BLUSH][i]}33` }]}>
              <CheckIcon size={15} color={INK} />
            </View>
            <T v="body">{f}</T>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 22, gap: 10 }}>
        {plans === null && <ActivityIndicator color={INK} style={{ marginVertical: 30 }} />}
        {plans !== null && plans.length === 0 && (
          <View style={styles.unavailable}>
            <T v="body" style={styles.center}>
              {t('pwUnavailable')}
            </T>
          </View>
        )}
        {ordered.length > 0 && (
          <T v="small" color={INK_SOFT} style={styles.center}>
            {t('pwChoose')}
          </T>
        )}
        {ordered.map((p) => (
          <Pressy
            key={p.id}
            onPress={() => void purchase(p)}
            disabled={!!busy || thanks}
            accessibilityRole="button"
            style={[styles.plan, SHADOW_SM, busy && busy !== p.id && { opacity: 0.6 }]}
            scaleTo={0.985}
            testID={`plan-${p.period}`}
          >
            <T v="h2">{p.period === 'year' ? t('pwYearly') : t('pwMonthly')}</T>
            <T v="h2" testID={`plan-${p.period}-price`}>
              {busy === p.id ? '…' : t('pwPer', { price: p.displayPrice, period: periodWord(p) })}
            </T>
          </Pressy>
        ))}
      </View>
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginTop: 4 },
  center: { textAlign: 'center' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 18, borderRadius: 22, backgroundColor: SURFACE },
  unavailable: { padding: 18, borderRadius: 20, backgroundColor: INK_FAINT },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  couponInput: { flex: 1, height: 46, borderRadius: 14, backgroundColor: INK_HAIR, paddingHorizontal: 14, fontFamily: FONT.displayMedium, fontSize: 16, color: INK },
  couponBtn: { height: 46, paddingHorizontal: 16, borderRadius: 14, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
});
