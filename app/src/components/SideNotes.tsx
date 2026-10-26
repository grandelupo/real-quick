import React, { useEffect, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { entryMacros, parseLocally, toUnit, type Entry, type Settings } from '../engine';
import { n, t, locale } from '../i18n';
import { addEntry } from '../store';
import { retry } from '../analyzer';
import { BLUSH, FONT, INK, INK_FAINT, INK_HAIR, INK_SOFT, PAPER, SHADOW, SURFACE } from '../theme';
import { EASE_OUT } from '../ui/motion';
import { Pressy, T, haptic } from '../ui/kit';
import { CloseIcon, LockIcon, PencilIcon, PlateIcon, RetryIcon, SendIcon } from '../ui/Icons';

// The food list: a sheet that slides in from the right with the day's
// entries. Fix, remove, or just type what you ate.

function Shimmer() {
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={s}>
      <T v="small" color={INK_SOFT}>
        {t('counting')}
      </T>
    </Animated.View>
  );
}

function entryTitle(e: Entry): string {
  if (e.title) return e.title;
  if (e.items[0]) return e.items.length > 1 ? `${e.items[0].name} +${e.items.length - 1}` : e.items[0].name;
  if (e.text) return e.text;
  return t('addedBy.photo');
}

function time(ms: number) {
  return new Date(ms).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function Row({ e, settings, onEdit, onPaywall }: { e: Entry; settings: Settings; onEdit(e: Entry): void; onPaywall(): void }) {
  const m = entryMacros(e);
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(260).easing(EASE_OUT)}>
      <Pressy style={styles.row} scaleTo={0.985} onPress={() => onEdit(e)} accessibilityLabel={`${entryTitle(e)}, ${n(toUnit(m.kcal, settings.unit))} ${settings.unit}`}>
        {e.photoUri ? (
          <Image source={{ uri: e.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbTyped]}>{e.source === 'text' ? <PencilIcon size={20} color={INK_SOFT} /> : <PlateIcon size={22} color={INK_SOFT} />}</View>
        )}
        <View style={{ flex: 1 }}>
          <T v="label" numberOfLines={1}>
            {entryTitle(e)}
          </T>
          {e.status === 'pending' && <Shimmer />}
          {e.status === 'ready' && (
            <T v="small" color={INK_SOFT} numberOfLines={1}>
              {time(e.createdAt)} · P {n(m.protein)} · C {n(m.carbs)} · F {n(m.fat)}
            </T>
          )}
          {e.status === 'failed' && (
            <T v="small" color={INK_SOFT} numberOfLines={2}>
              {e.problem === 'noFood' ? t('noFood') : t('failed')}
            </T>
          )}
          {e.status === 'limit' && (
            <T v="small" color={INK_SOFT} numberOfLines={2}>
              {t('limitReached')}
            </T>
          )}
        </View>
        {e.status === 'ready' && (
          <T v="h2" style={{ marginLeft: 8 }}>
            {n(toUnit(m.kcal, settings.unit))}
          </T>
        )}
        {e.status === 'failed' && (
          <Pressy style={styles.chip} onPress={() => retry(e.id)} accessibilityLabel={t('retry')}>
            <RetryIcon size={18} />
          </Pressy>
        )}
        {e.status === 'limit' && (
          <Pressy style={[styles.chip, { backgroundColor: BLUSH }]} onPress={onPaywall} accessibilityLabel={t('unlock')}>
            <LockIcon size={18} />
          </Pressy>
        )}
      </Pressy>
    </Animated.View>
  );
}

export function SideNotes({
  progress,
  width,
  title,
  day,
  isToday,
  entries,
  settings,
  onClose,
  onEdit,
  onPaywall,
}: {
  progress: SharedValue<number>;
  width: number;
  title: string;
  day: string;
  isToday: boolean;
  entries: Entry[];
  settings: Settings;
  onClose(): void;
  onEdit(e: Entry): void;
  onPaywall(): void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const panelW = Math.min(width * 0.9, 440);

  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - progress.value) * (panelW + 24) }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.3 }));

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    // Typed food is filed on the day being viewed, at "now" on that day.
    const at = new Date();
    if (!isToday) {
      const [y, m, d] = day.split('-').map(Number);
      at.setFullYear(y, m - 1, d);
    }
    const local = parseLocally(v);
    if (local) addEntry({ source: 'text', text: v, items: local, title: v, at });
    else addEntry({ source: 'text', text: v, at });
    haptic('success');
    setText('');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: INK }, scrim]} pointerEvents="none" />
      <Animated.View style={[styles.panel, SHADOW, { width: panelW, paddingTop: insets.top + 12 }, panel]}>
        <View style={styles.header}>
          <T v="title" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
            {title}
          </T>
          <Pressy style={styles.closeBtn} onPress={onClose} accessibilityLabel={t('closePreview')}>
            <CloseIcon size={20} />
          </Pressy>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            data={entries}
            keyExtractor={(e) => e.id}
            contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
            renderItem={({ item }) => <Row e={item} settings={settings} onEdit={onEdit} onPaywall={onPaywall} />}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyMark}>
                  <PlateIcon size={30} color={INK_SOFT} />
                </View>
                <T v="body" color={INK_SOFT} style={{ textAlign: 'center', marginTop: 14 }}>
                  {t('nothingYet')}
                </T>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
          <View style={[styles.inputRow, { marginBottom: Math.max(insets.bottom, 14) }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('typeHere')}
              placeholderTextColor={INK_SOFT}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submit}
              maxLength={300}
              accessibilityLabel={t('typeHere')}
            />
            <Pressy style={[styles.send, !text.trim() && { opacity: 0.4 }]} onPress={submit} disabled={!text.trim()} accessibilityLabel={t('add')}>
              <SendIcon size={22} color={SURFACE} />
            </Pressy>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: PAPER,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 6, paddingLeft: 6 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: INK_FAINT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 18 },
  sep: { height: 1, backgroundColor: INK_HAIR, marginLeft: 68 },
  thumb: { width: 50, height: 50, borderRadius: 14, backgroundColor: SURFACE },
  thumbTyped: { alignItems: 'center', justifyContent: 'center', backgroundColor: INK_HAIR },
  chip: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: INK_FAINT },
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 24 },
  emptyMark: { width: 72, height: 72, borderRadius: 36, backgroundColor: INK_HAIR, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: INK_HAIR,
    color: INK,
    fontFamily: FONT.body,
    fontSize: 16,
  },
  send: { width: 52, height: 52, borderRadius: 18, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
});
