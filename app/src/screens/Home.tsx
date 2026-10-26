import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Linking, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { addDays, dayKey, dayPages, isNight, msUntilLookChange, weekdayIndex, type Entry } from '../engine';
import { dayLabel, t } from '../i18n';
import { entriesFor, markSeen, useStore } from '../store';
import { DAYS, INK, NIGHT_BG, PAPER, SHADOW, SPRING, SPRING_SOFT } from '../theme';
import { DayPage } from '../components/DayPage';
import { BAR_HEIGHT, CaptureBar, type CaptureHandle } from '../components/CaptureBar';
import { SideNotes } from '../components/SideNotes';
import { EditSheet } from '../components/EditSheet';
import { SettingsSheet } from '../components/SettingsSheet';
import { Paywall } from '../components/Paywall';
import { ShareCardHost, type ShareHandle } from '../components/Share';
import { Toast, useToast } from '../components/Toast';
import { CogIcon, NotesIcon, ShareIcon } from '../ui/Icons';
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

export function Home({ showPaywallOnMount }: { showPaywallOnMount?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const now = useClock();
  const settings = useStore((s) => s.settings);
  const entries = useStore((s) => s.entries);
  const firstDay = useStore((s) => s.firstDay);
  const seen = useStore((s) => s.seen);

  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const night = settings.nightLook && isNight(now);
  const pages = useMemo(() => dayPages(today, firstDay), [today, firstDay]);
  const [index, setIndex] = useState(0);
  const viewing = pages[Math.min(index, pages.length - 1)] ?? today;

  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(!!showPaywallOnMount);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const sheetsOpen = settingsOpen || paywallOpen || editOpen;

  const list = useRef<FlatList<string>>(null);
  const capture = useRef<CaptureHandle>(null);
  const shareRef = useRef<ShareHandle>(null);
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

  // --- deep links: realquick://snap (widgets, lock-screen control) ---------
  const handleUrl = useCallback((url: string | null) => {
    const intent = snapIntent(url);
    if (!intent) return;
    setSettingsOpen(false);
    setPaywallOpen(false);
    setEditOpen(false);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    setIndex(0);
    capture.current?.autoSnap(intent.fromWidget);
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [handleUrl]);

  // --- side notes: swipe left to open, right to close -----------------------
  const notes = useSharedValue(0);
  const start = useSharedValue(0);
  const panelW = Math.min(width * 0.9, 440);
  const setOpen = useCallback(
    (open: boolean) => {
      notes.value = withSpring(open ? 1 : 0, SPRING);
      setNotesOpen(open);
      if (open) markSeen('notes');
    },
    [notes],
  );
  const pan = Gesture.Pan()
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
      notes.value = withSpring(open ? 1 : 0, SPRING);
      runOnJS(setNotesOpen)(open);
      if (open) runOnJS(markSeen)('notes');
    });

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

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / height);
    if (i !== index) {
      setIndex(Math.max(0, Math.min(pages.length - 1, i)));
      haptic('light');
      markSeen('scroll');
    }
  };

  // --- the TikTok nudge: show the two gestures until they have been used --
  // The page itself dips to reveal a sliver of yesterday; the food list peeks
  // in from the right. Each plays after a quiet moment, a few times per launch.
  const [peeks, setPeeks] = useState(0);
  const dip = useSharedValue(0);
  const dipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dip.value }],
  }));
  // What sits above today's page (and behind iOS overscroll): the day before.
  const above = pages[index + 1] ?? addDays(viewing, -1);
  const aboveBg = night ? NIGHT_BG : DAYS[weekdayIndex(above)].bg;
  useEffect(() => {
    const idle = !sheetsOpen && !notesOpen && appActive && index === 0;
    const want = !seen.scroll ? 'scroll' : !seen.notes ? 'notes' : null;
    if (!idle || !want || peeks >= 3) return;
    const id = setTimeout(
      () => {
        if (want === 'scroll') {
          // Dip the whole pager so a band of the day above shows, then settle.
          dip.value = withSequence(withSpring(72, SPRING_SOFT), withDelay(380, withSpring(0, SPRING)));
        } else {
          notes.value = withSequence(withSpring(0.16, SPRING), withDelay(650, withSpring(0, SPRING)));
        }
        setPeeks((n) => n + 1);
      },
      peeks === 0 ? 2200 : 9000,
    );
    return () => clearTimeout(id);
  }, [seen, sheetsOpen, notesOpen, appActive, index, peeks, notes, dip]);

  const viewingEntries = useMemo(() => entriesFor(viewing, entries), [viewing, entries]);
  const bottomReserve = Math.max(insets.bottom, 12) + BAR_HEIGHT + 18;

  const hintFor = (day: string): { text: string; dir: 'up' | 'left' } | undefined => {
    if (day !== today) return undefined;
    if (!seen.scroll) return { text: t('scrollHint'), dir: 'up' };
    if (!seen.notes) return { text: t('notesHint'), dir: 'left' };
    return undefined;
  };

  return (
    <View style={[styles.root, { backgroundColor: aboveBg }]}>
      <StatusBar style="dark" />
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, dipStyle]}>
            <FlatList
              ref={list}
              data={pages}
              inverted
              pagingEnabled
              showsVerticalScrollIndicator={false}
              keyExtractor={(d) => d}
              getItemLayout={(_, i) => ({
                length: height,
                offset: height * i,
                index: i,
              })}
              initialNumToRender={2}
              windowSize={3}
              maxToRenderPerBatch={2}
              onMomentumScrollEnd={onScrollEnd}
              onScroll={onScrollEnd}
              scrollEventThrottle={64}
              decelerationRate="fast"
              renderItem={({ item, index: i }) => (
                <DayPage
                  day={item}
                  label={dayLabel(item, today, yesterday)}
                  width={width}
                  height={height}
                  active={i === index && appActive && !sheetsOpen}
                  night={night}
                  entries={entriesFor(item, entries)}
                  settings={settings}
                  topInset={insets.top}
                  bottomReserve={bottomReserve}
                  hint={hintFor(item)}
                />
              )}
            />
          </Animated.View>

          {/* food-list tab on the right edge: a visible door for the swipe */}
          <Animated.View style={[styles.tab, { top: height * 0.42 }, tabStyle]}>
            <Pressy onPress={() => setOpen(true)} style={[styles.tabBtn, SHADOW]} accessibilityLabel={t('notesHint')} testID="notes-tab">
              <NotesIcon size={22} />
              {viewingEntries.length > 0 && (
                <Animated.View entering={FadeIn} style={styles.badge}>
                  <T v="small" style={{ fontSize: 11, lineHeight: 14 }} color={PAPER}>
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
          />
        </View>
      </GestureDetector>

      {/* top-right: share + settings */}
      <Animated.View style={[styles.topRight, { top: insets.top + 8 }, chromeStyle]} pointerEvents={notesOpen ? 'none' : 'box-none'}>
        <Pressy
          style={[styles.roundBtn, SHADOW]}
          onPress={() => void shareRef.current?.share(viewing, dayLabel(viewing, today, yesterday), viewingEntries, settings)}
          accessibilityLabel={t('share')}
          testID="share-button"
        >
          <ShareIcon size={22} />
        </Pressy>
        <Pressy style={[styles.roundBtn, SHADOW]} onPress={() => setSettingsOpen(true)} accessibilityLabel={t('settings')} testID="settings-button">
          <CogIcon size={24} />
        </Pressy>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, barStyle]} pointerEvents={notesOpen ? 'none' : 'box-none'}>
        <CaptureBar
          ref={capture}
          active={appActive && !sheetsOpen}
          onToast={(m) => {
            toast.show(m);
            // A fresh snap always lands on today's page.
            if (index !== 0) {
              list.current?.scrollToOffset({ offset: 0, animated: true });
              setIndex(0);
            }
          }}
        />
      </Animated.View>
      <Toast msg={toast.msg} bottom={bottomReserve + 4} />

      <EditSheet entry={editing} visible={editOpen} settings={settings} onClose={() => setEditOpen(false)} />
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onPaywall={() => {
          setSettingsOpen(false);
          setTimeout(() => setPaywallOpen(true), 260);
        }}
      />
      <Paywall visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
      <ShareCardHost ref={shareRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PAPER,
    borderWidth: 2.5,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: { position: 'absolute', right: -6 },
  tabBtn: {
    width: 50,
    height: 58,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    backgroundColor: PAPER,
    borderWidth: 2.5,
    borderColor: INK,
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
