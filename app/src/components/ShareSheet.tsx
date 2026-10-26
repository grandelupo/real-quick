import React, { useState } from 'react';
import { ActivityIndicator, Share as RNShare, StyleSheet, View } from 'react-native';
import { Hero } from '../art/Hero';
import { dayKey, weekdayIndex } from '../engine';
import { t } from '../i18n';
import { startSharing, stopSharing } from '../share';
import { useStore } from '../store';
import { DAYS, INK, INK_HAIR, INK_SOFT } from '../theme';
import { T } from '../ui/kit';
import { Button, Field, SectionTitle } from '../ui/controls';
import { Sheet } from './Sheet';

// The share sheet: start a live link, send it again, or stop. One link per
// install; it shows today and the history while sharing is on.

export function ShareSheet({ visible, onClose, onToast }: { visible: boolean; onClose(): void; onToast(text: string): void }) {
  const share = useStore((s) => s.share);
  const savedName = useStore((s) => s.settings.shareName);
  const [name, setName] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const wd = weekdayIndex(dayKey(new Date()));

  const send = async (url: string) => {
    await RNShare.share({ message: t('shareMessage', { url }) }).catch(() => undefined);
  };

  const start = async () => {
    setBusy(true);
    try {
      const url = await startSharing(name);
      await send(url);
    } catch {
      onToast(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await stopSharing();
      onToast(t('shareStopped'));
      onClose();
    } catch {
      onToast(t('shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.hero}>
        <Hero kind={DAYS[wd].hero} size={110} />
        <T v="title" style={styles.center}>
          {share ? t('shareOn') : t('shareSheetTitle')}
        </T>
        <T v="body" color={INK_SOFT} style={styles.center}>
          {t('shareSheetBody')}
        </T>
      </View>

      {share ? (
        <>
          <View style={styles.linkBox}>
            <T v="small" color={INK} selectable numberOfLines={2}>
              {share.url}
            </T>
          </View>
          <T v="small" color={INK_SOFT} style={[styles.center, { marginTop: 8 }]}>
            {t('shareLinkHint')}
          </T>
          <View style={{ height: 18 }} />
          <Button label={t('shareSend')} onPress={() => void send(share.url)} disabled={busy} />
          <View style={{ height: 8 }} />
          <Button label={t('shareStop')} kind="danger" onPress={() => void stop()} disabled={busy} />
        </>
      ) : (
        <>
          <SectionTitle>{t('shareNameLabel')}</SectionTitle>
          <Field value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" accessibilityLabel={t('shareNameLabel')} />
          <View style={{ height: 18 }} />
          {busy ? <ActivityIndicator color={INK} style={{ marginVertical: 14 }} /> : <Button label={t('shareStart')} onPress={() => void start()} testID="share-start" />}
          <T v="small" color={INK_SOFT} style={[styles.center, { marginTop: 10 }]}>
            {t('shareLinkHint')}
          </T>
        </>
      )}
      <View style={{ height: 12 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6 },
  center: { textAlign: 'center' },
  linkBox: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: INK_HAIR },
});
