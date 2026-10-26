import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { entryMacros, parseLocally, toUnit, type Entry, type Settings } from '../engine';
import { n, t, locale } from '../i18n';
import { addEntry } from '../store';
import { retry } from '../analyzer';
import { BLUSH, FONT, INK, INK_FAINT, INK_SOFT, PAPER, SHADOW } from '../theme';
import { Pressy, T, haptic } from '../ui/kit';
import { CloseIcon, LockIcon, RetryIcon, SendIcon } from '../ui/Icons';
import { Mascot } from '../art/Mascot';

// "Side notes": a sheet of lined paper that slides in from the right with
// the day's food. Fix, remove, or just type what you ate.

function Shimmer() {
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={s}>
      <T v="label" color={INK_SOFT}>
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
  const emoji = e.items[0]?.emoji ?? (e.source === 'text' ? '✏️' : '📸');
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} layout={LinearTransition.springify().damping(20)}>
      <Pressy style={styles.row} scaleTo={0.97} onPress={() => onEdit(e)} accessibilityLabel={`${entryTitle(e)}, ${n(toUnit(m.kcal, settings.unit))} ${settings.unit}`}>
        {e.photoUri ? (
          <Image source={{ uri: e.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.emoji]}>
            <T style={{ fontSize: 26, lineHeight: 32 }}>{emoji}</T>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T v="label" numberOfLines={1}>
            {e.status === 'ready' ? `${emoji}  ${entryTitle(e)}` : entryTitle(e)}
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
  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.35 }));

  const lines = useMemo(() => Array.from({ length: 40 }, (_, i) => i), []);

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
        {/* ruled paper */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {lines.map((i) => (
            <View key={i} style={[styles.rule, { top: insets.top + 96 + i * 34 }]} />
          ))}
          <View style={styles.margin} />
        </View>
        <View style={styles.tape} />
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
            ListEmptyComponent={
              <View style={styles.empty}>
                <Mascot size={96} pose="sleep" />
                <T v="body" color={INK_SOFT} style={{ textAlign: 'center', marginTop: 10 }}>
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
              <SendIcon size={22} />
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
    borderLeftWidth: 2.5,
    borderColor: INK,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  rule: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(120,160,230,0.18)' },
  margin: { position: 'absolute', left: 12, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(255,120,140,0.28)' },
  tape: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    left: '38%',
    width: 86,
    height: 22,
    backgroundColor: 'rgba(255,158,181,0.55)',
    transform: [{ rotate: '-3deg' }],
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 6, paddingLeft: 8 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: INK_FAINT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 18 },
  thumb: { width: 50, height: 50, borderRadius: 14, borderWidth: 2, borderColor: INK, backgroundColor: '#FFFFFF' },
  emoji: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F5' },
  chip: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: INK_FAINT },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: INK,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    color: INK,
    fontFamily: FONT.body,
    fontSize: 16,
  },
  send: { width: 52, height: 52, borderRadius: 18, borderWidth: 2.5, borderColor: INK, backgroundColor: BLUSH, alignItems: 'center', justifyContent: 'center' },
});
