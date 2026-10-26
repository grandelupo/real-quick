import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { addDays, dayKey, dayPages, dayTotals, freeDaysLeft, isNight, macroTargets, msUntilLookChange, weekdayIndex, type Entry } from '../engine';
import { dayLabel, t } from '../i18n';
import { entriesFor, markSeen, useStore } from '../store';
import { DAYS, INK, NIGHT_BG, SHADOW_SM, SURFACE } from '../theme';
import { DayPage } from '../components/DayPage';
import { MacroStrip } from '../components/MacroStrip';
import { Forest, type ForestHandle } from '../forest/Forest';
import { BAR_HEIGHT, CaptureBar, type CaptureHandle } from '../components/CaptureBar';
import { SideNotes } from '../components/SideNotes';
import { EditSheet } from '../components/EditSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { Paywall } from '../components/Paywall';
import { ShareSheet } from '../components/ShareSheet';
import { Toast, useToast } from '../components/Toast';
import { CogIcon, NotesIcon, ShareIcon } from '../ui/Icons';
import { EASE_OUT, TIMING } from '../ui/motion';
import { Pressy, T, haptic } from '../ui/kit';

/** Ticks at midnight and at the day/night boundaries so the look follows the clock. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 1, 0);
    const wait = Math.min(msUntilLookChange(now), midnight.getTime() - now.getTime());
    const id = setTimeout(() => setNow(new Date()), Math.max(1000, wait + 500));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(new Date()));
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [now]);
  return now;
}

function snapIntent(url: string | null): { fromWidget: boolean } | null {
  if (!url) return null;
  const m = url.match(/^realquick:\/\/+snap(?:\?(.*))?$/i);
  if (!m) return null;
  return { fromWidget: /(^|&)from=widget(&|$)/.test(m[1] ?? '') };
}

/** How far a swipe has to travel to roll one day. */
const ROLL_DISTANCE = 260;

export function Home({ showPaywallOnMount }: { showPaywallOnMount?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const now = useClock();
  const settings = useStore((s) => s.settings);
  const entries = useStore((s) => s.entries);
  const firstDay = useStore((s) => s.firstDay);
  const seen = useStore((s) => s.seen);
  const isPro = useStore((s) => s.isPro);

  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const night = settings.nightLook && isNight(now);
  const pages = useMemo(() => dayPages(today, firstDay), [today, firstDay]);
  const [index, setIndex] = useState(0);
  const viewing = pages[Math.min(index, pages.length - 1)] ?? today;

  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(!!showPaywallOnMount);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const sheetsOpen = settingsOpen || paywallOpen || editOpen || shareOpen;
  // The free window: 3 days from first launch, then every count needs Pro.
  const daysLeft = freeDaysLeft(firstDay, today);
  const locked = !isPro && daysLeft === 0;
  const trialNote = isPro ? undefined : daysLeft === 0 ? t('trialOver') : daysLeft === 1 ? t('trialLastDay') : t('trialDaysLeft', { n: daysLeft });

  const capture = useRef<CaptureHandle>(null);
  const forest = useRef<ForestHandle>(null);
  const toast = useToast();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // Keep the edit sheet's entry fresh while it is open (analysis may land).
  useEffect(() => {
    if (!editing) return;
    const fresh = entries.find((e) => e.id === editing.id);
    if (fresh && fresh !== editing) setEditing(fresh);
    if (!fresh && editOpen) setEditOpen(false);
  }, [entries, editing, editOpen]);

  // --- the day roll: swipe up for the day before, down for the day after ----
  // `roll` is 0…1 along the way to `target`; the planet rolls with it and the
  // day's content crossfades. Direction +1 = older day (the planet rolls
  // forward, the next forest comes over the far horizon).
  const roll = useSharedValue(0);
  const [target, setTarget] = useState<{ index: number; dir: 1 | -1 } | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const dayState = useCallback(
    (day: string) => {
      const totals = dayTotals(entriesFor(day, entries));
      const ratio = settings.goalKcal > 0 ? totals.kcal / settings.goalKcal : 0;
      return { totals, growth: Math.min(1, ratio), over: Math.min(1, Math.max(0, (ratio - 1.05) / 0.5)) };
    },
    [entries, settings.goalKcal],
  );

  const beginRoll = useCallback(
    (dir: 1 | -1) => {
      const next = index + dir;
      if (next < 0 || next >= pages.length) return;
      const day = pages[next];
      const st = dayState(day);
      forest.current?.beginRoll(dir, weekdayIndex(day), st.growth, st.over);
      setTarget({ index: next, dir });
    },
    [index, pages, dayState],
  );
  const finishRoll = useCallback(
    (commit: boolean) => {
      const tg = targetRef.current;
      if (commit && tg) {
        forest.current?.commitRoll();
        setIndex(tg.index);
        haptic('light');
        markSeen('scroll');
      } else {
        forest.current?.cancelRoll();
      }
      roll.value = 0;
      setTarget(null);
    },
    [roll],
  );

  const dayPan = Gesture.Pan()
    .activeOffsetY([-18, 18])
    .failOffsetX([-14, 14])
    .onChange((e) => {
      const dir: 1 | -1 = e.translationY < 0 ? 1 : -1;
      const tg = targetRef.current;
      if (!tg || tg.dir !== dir) {
        runOnJS(beginRoll)(dir);
        return;
      }
      roll.value = Math.min(1, Math.abs(e.translationY) / ROLL_DISTANCE);
    })
    .onEnd((e) => {
      const tg = targetRef.current;
      if (!tg) return;
      const goes = roll.value > 0.35 || (tg.dir === 1 ? e.velocityY < -600 : e.velocityY > 600);
      roll.value = withTiming(goes ? 1 : 0, { duration: goes ? 420 : 260, easing: EASE_OUT }, (done) => {
        if (done) runOnJS(finishRoll)(goes);
      });
    });

  // --- side notes: swipe left to open, right to close -----------------------
  const notes = useSharedValue(0);
  const start = useSharedValue(0);
  const panelW = Math.min(width * 0.9, 440);
  const setOpen = useCallback(
    (open: boolean) => {
      notes.value = withTiming(open ? 1 : 0, TIMING);
      setNotesOpen(open);
      if (open) markSeen('notes');
    },
    [notes],
  );
  const notesPan = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onStart(() => {
      start.value = notes.value;
    })
    .onChange((e) => {
      notes.value = Math.min(1, Math.max(0, start.value - e.translationX / panelW));
    })
    .onEnd((e) => {
      const open = e.velocityX < -500 || (e.velocityX < 500 && notes.value > 0.5);
      notes.value = withTiming(open ? 1 : 0, TIMING);
      runOnJS(setNotesOpen)(open);
      if (open) runOnJS(markSeen)('notes');
    });
  const gestures = Gesture.Race(notesPan, dayPan);

  // --- deep links: realquick://snap (widgets, lock-screen control) ---------
  const handleUrl = useCallback(
    (url: string | null) => {
      const intent = snapIntent(url);
      if (!intent) return;
      setSettingsOpen(false);
      setPaywallOpen(false);
      setEditOpen(false);
      setShareOpen(false);
      finishRoll(false);
      setIndex(0);
      capture.current?.autoSnap(intent.fromWidget);
    },
    [finishRoll],
  );

  useEffect(() => {
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [handleUrl]);

  const tabStyle = useAnimatedStyle(() => ({
    opacity: 1 - notes.value,
    transform: [{ translateX: notes.value * 40 }],
  }));
  // The camera keeps running under the notes (no restart delay); it just slides away.
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - notes.value }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: 1 - notes.value,
    transform: [{ translateY: notes.value * 120 }],
  }));
  // The current day's content leaves as the roll progresses; the target's arrives.
  const dirSign = target?.dir ?? 1;
  const currentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0, 0.42], [1, 0], 'clamp'),
    transform: [{ translateY: roll.value * -24 * dirSign }],
  }));
  const targetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(roll.value, [0.58, 1], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - roll.value) * 24 * dirSign }],
  }));

  const viewingEntries = useMemo(() => entriesFor(viewing, entries), [viewing, entries]);
  const barBottom = Math.max(insets.bottom, 12);
  // The forest band: from the bottom edge up to a bit under the ring. The
  // macro chips and the capture bar float over its foreground.
  const forestH = Math.round(height * 0.46);
  const stripBottom = barBottom + BAR_HEIGHT + 12;
  const bottomReserve = forestH - 24;
  const current = dayState(viewing);
  const targets = useMemo(() => macroTargets(settings.goalKcal), [settings.goalKcal]);
  const targetDay = target ? pages[target.index] : null;

  // Quiet hints for the two gestures, until each has been used once.
  const hintFor = (day: string): { text: string; dir: 'up' | 'left' } | undefined => {
    if (day !== today) return undefined;
    if (!seen.scroll) return { text: t('scrollHint'), dir: 'up' };
    if (!seen.notes) return { text: t('notesHint'), dir: 'left' };
    return undefined;
  };

  const page = (day: string) => (
    <DayPage
      day={day}
      label={dayLabel(day, today, yesterday)}
      width={width}
      height={height}
      active={appActive && !sheetsOpen}
      night={night}
      entries={entriesFor(day, entries)}
      settings={settings}
      topInset={insets.top}
      bottomReserve={bottomReserve}
      hint={hintFor(day)}
      note={day === today ? trialNote : undefined}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: night ? NIGHT_BG : DAYS[weekdayIndex(viewing)].bg }]}>
      <StatusBar style="dark" />
      <GestureDetector gesture={gestures}>
        <View style={StyleSheet.absoluteFill}>
          {targetDay ? (
            <Animated.View style={[StyleSheet.absoluteFill, targetStyle]} pointerEvents="none">
              {page(targetDay)}
            </Animated.View>
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, currentStyle]} pointerEvents="none">
            {page(viewing)}
          </Animated.View>

          {/* the forest and the macro chips sit over the pages, under the notes */}
          <Forest ref={forest} width={width} height={forestH} weekday={weekdayIndex(viewing)} growth={current.growth} over={current.over} night={night} active={appActive} roll={roll} />
          <Animated.View style={[styles.strip, { bottom: stripBottom }, barStyle]} pointerEvents="none">
            <MacroStrip totals={current.totals} targets={targets} night={night} />
          </Animated.View>

          {/* food-list tab on the right edge: a visible door for the swipe */}
          <Animated.View style={[styles.tab, { top: height * 0.42 }, tabStyle]}>
            <Pressy onPress={() => setOpen(true)} style={[styles.tabBtn, SHADOW_SM]} accessibilityLabel={t('notesHint')} testID="notes-tab">
              <NotesIcon size={22} />
              {viewingEntries.length > 0 && (
                <Animated.View entering={FadeIn} style={styles.badge}>
                  <T v="small" style={{ fontSize: 11, lineHeight: 14 }} color={SURFACE}>
                    {viewingEntries.length}
                  </T>
                </Animated.View>
              )}
            </Pressy>
          </Animated.View>

          {notesOpen && (
            <Pressy
              style={[StyleSheet.absoluteFill, { right: panelW }]}
              onPress={() => setOpen(false)}
              hapticKind="none"
              scaleTo={1}
              accessibilityLabel="Close"
            />
          )}
          <SideNotes
            progress={notes}
            width={width}
            title={viewing === today ? t('foodToday') : t('foodOn', { d: dayLabel(viewing, today, yesterday) })}
            day={viewing}
            isToday={viewing === today}
            entries={viewingEntries}
            settings={settings}
            onClose={() => setOpen(false)}
            onEdit={(e) => {
              setEditing(e);
              setEditOpen(true);
            }}
            onPaywall={() => setPaywallOpen(true)}
            locked={locked}
          />
        </View>
      </GestureDetector>

      {/* top-right: share + settings */}
      <Animated.View style={[styles.topRight, { top: insets.top + 8 }, chromeStyle]} pointerEvents={notesOpen ? 'none' : 'box-none'}>
        <Pressy style={[styles.roundBtn, SHADOW_SM]} onPress={() => setShareOpen(true)} accessibilityLabel={t('share')} testID="share-button">
          <ShareIcon size={21} />
        </Pressy>
        <Pressy style={[styles.roundBtn, SHADOW_SM]} onPress={() => setSettingsOpen(true)} accessibilityLabel={t('settings')} testID="settings-button">
          <CogIcon size={23} />
        </Pressy>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents={notesOpen ? 'none' : 'box-none'}>
        <CaptureBar
          ref={capture}
          active={appActive && !sheetsOpen}
          locked={locked}
          onLocked={() => setPaywallOpen(true)}
          onToast={(m) => {
            toast.show(m);
            // A fresh snap always lands on today's page.
            if (index !== 0) {
              finishRoll(false);
              setIndex(0);
            }
          }}
        />
      </Animated.View>
      <Toast msg={toast.msg} bottom={stripBottom + 62} />

      <EditSheet entry={editing} visible={editOpen} settings={settings} onClose={() => setEditOpen(false)} />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPaywall={() => {
          setSettingsOpen(false);
          setTimeout(() => setPaywallOpen(true), 260);
        }}
        onShare={() => {
          setSettingsOpen(false);
          setTimeout(() => setShareOpen(true), 260);
        }}
      />
      <Paywall visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} onToast={(text) => toast.show({ text })} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  strip: { position: 'absolute', left: 0, right: 0 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: { position: 'absolute', right: -6 },
  tabBtn: {
    width: 50,
    height: 58,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 6,
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
