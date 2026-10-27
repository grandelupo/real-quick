import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, Image, Linking, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isButtonCollapsed } from '../engine';
import { t } from '../i18n';
import { storeCapture } from '../photos';
import { addEntry, newId, useStore } from '../store';
import { ABS, BLUSH_DEEP, FONT, INK, INK_SOFT, SHADOW, SURFACE } from '../theme';
import { CameraIcon, CloseIcon } from '../ui/Icons';
import { EASE_IN_OUT, EASE_OUT, TIMING_SLOW } from '../ui/motion';
import { Pressy, T, haptic } from '../ui/kit';
import { Hero } from '../art/Hero';

// The bottom bar: a live mini camera preview next to one big button. Tap the
// button and forget it — the photo is taken from the already-running preview
// (no camera start-up delay), saved, and counted in the background.

export const BAR_HEIGHT = 76;
const PREVIEW = 64;
const SIDE = 16;
const GAP = 12;

export interface CaptureHandle {
  /** Called by deep links / widgets. Fires as soon as the camera is ready. */
  autoSnap(fromWidget: boolean): void;
}

interface Props {
  /** False while a sheet covers the screen — the camera sleeps. */
  active: boolean;
  /** The free days are over and there is no Pro: a tap opens the paywall instead. */
  locked: boolean;
  onLocked(): void;
  onToast(msg: { text: string; sub?: string; action?: { label: string; run(): void } }): void;
}

export const CaptureBar = forwardRef<CaptureHandle, Props>(function CaptureBar({ active, locked, onLocked, onToast }, ref) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [big, setBig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flyUri, setFlyUri] = useState<string | null>(null);
  const pendingAuto = useRef<null | { fromWidget: boolean }>(null);
  const snaps = useStore((s) => s.totalSnaps - s.buttonResetAt);
  const collapsed = isButtonCollapsed(snaps);

  const granted = perm?.granted === true;

  // --- geometry of the preview, small ↔ big -----------------------------
  const bottom = Math.max(insets.bottom, 12);
  const barTop = height - bottom - BAR_HEIGHT;
  const small = { x: SIDE, y: barTop + (BAR_HEIGHT - PREVIEW) / 2, w: PREVIEW, h: PREVIEW, r: 20 };
  const bigW = width - SIDE * 2;
  const bigH = Math.min(bigW * (4 / 3), barTop - insets.top - 40);
  const large = { x: SIDE, y: barTop - bigH - 16, w: bigW, h: bigH, r: 32 };

  const k = useSharedValue(0); // 0 small, 1 big
  const flash = useSharedValue(0);
  const fly = useSharedValue(0);

  useEffect(() => {
    k.value = withTiming(big ? 1 : 0, TIMING_SLOW);
  }, [big, k]);

  const previewStyle = useAnimatedStyle(() => ({
    left: interpolate(k.value, [0, 1], [small.x, large.x]),
    top: interpolate(k.value, [0, 1], [small.y, large.y]),
    width: interpolate(k.value, [0, 1], [small.w, large.w]),
    height: interpolate(k.value, [0, 1], [small.h, large.h]),
    borderRadius: interpolate(k.value, [0, 1], [small.r, large.r]),
  }));
  // The clip inside the box gets the size only: an animated left/top would
  // win over the static zero and carry the clip off the box.
  const clipStyle = useAnimatedStyle(() => ({
    width: interpolate(k.value, [0, 1], [small.w, large.w]),
    height: interpolate(k.value, [0, 1], [small.h, large.h]),
    borderRadius: interpolate(k.value, [0, 1], [small.r, large.r]),
  }));
  // The camera view itself is never resized (native preview layers lag behind
  // layout animation): it stays at the big size and is scaled and centred
  // inside the animated clip, so it tracks the box frame for frame and
  // covers it exactly at both ends.
  const camStyle = useAnimatedStyle(() => {
    const w = interpolate(k.value, [0, 1], [small.w, large.w]);
    const h = interpolate(k.value, [0, 1], [small.h, large.h]);
    const s0 = Math.max(small.w / large.w, small.h / large.h);
    return {
      transform: [{ translateX: (w - large.w) / 2 }, { translateY: (h - large.h) / 2 }, { scale: interpolate(k.value, [0, 1], [s0, 1]) }],
    };
  });
  const smallEdgeStyle = useAnimatedStyle(() => ({ opacity: 1 - k.value }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: k.value * 0.5 }));
  const bigChrome = useAnimatedStyle(() => ({ opacity: interpolate(k.value, [0.6, 1], [0, 1], 'clamp') }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  // The snapped photo lifts out of the preview and drifts toward the food list.
  const flyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fly.value, [0, 0.12, 0.8, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(fly.value, [0, 1], [0, width - SIDE * 2 - PREVIEW]) },
      { translateY: interpolate(fly.value, [0, 1], [0, -height * 0.4]) },
      { scale: interpolate(fly.value, [0, 0.25, 1], [1, 1.15, 0.5]) },
    ],
  }));

  // --- capture ------------------------------------------------------------
  const finishWidgetFlow = useCallback(() => {
    // Android: hand the screen back to wherever the user was. iOS does not
    // allow apps to close themselves, so the confirmation simply stays.
    if (Platform.OS === 'android') setTimeout(() => BackHandler.exitApp(), 1500);
  }, []);

  const snap = useCallback(
    async (source: 'photo' | 'widget' = 'photo') => {
      if (busy) return;
      if (locked) {
        onLocked();
        return;
      }
      if (!granted) {
        const r = await requestPerm();
        if (!r.granted) {
          onToast({
            text: t('cameraDenied'),
            action: r.canAskAgain ? undefined : { label: t('openSettings'), run: () => void Linking.openSettings() },
          });
          return;
        }
        // The preview mounts now; snap as soon as it reports ready.
        pendingAuto.current = { fromWidget: source === 'widget' };
        return;
      }
      if (!cam.current || !ready) return;
      setBusy(true);
      haptic('medium');
      flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 260 }));
      try {
        const pic = await cam.current.takePictureAsync({ quality: 0.7, exif: false });
        if (!pic?.uri) throw new Error('no photo');
        setFlyUri(pic.uri);
        fly.value = 0;
        fly.value = withDelay(40, withTiming(1, { duration: 720, easing: EASE_IN_OUT }, (done) => {
          if (done) runOnJS(setFlyUri)(null);
        }));
        const id = newId();
        const stored = await storeCapture(pic.uri, id, pic.width, pic.height);
        addEntry({ id, source, photoUri: stored });
        haptic('success');
        onToast({ text: t('gotIt'), sub: t('countingNow') });
        if (big) setBig(false);
      } catch {
        haptic('warning');
        onToast({ text: t('failed') });
      } finally {
        setBusy(false);
      }
    },
    [busy, locked, onLocked, granted, ready, requestPerm, onToast, flash, fly, big],
  );

  // Deep-link / widget auto snap: wait for the camera, then fire once.
  useEffect(() => {
    if (!pendingAuto.current || !ready || !active) return;
    const { fromWidget } = pendingAuto.current;
    pendingAuto.current = null;
    void snap(fromWidget ? 'widget' : 'photo').then(() => {
      if (fromWidget) finishWidgetFlow();
    });
  }, [ready, active, snap, finishWidgetFlow]);

  useImperativeHandle(ref, () => ({
    autoSnap(fromWidget) {
      pendingAuto.current = { fromWidget };
      if (!granted) void requestPerm();
      if (ready && active) {
        pendingAuto.current = null;
        void snap(fromWidget ? 'widget' : 'photo').then(() => fromWidget && finishWidgetFlow());
      }
    },
  }));

  useEffect(() => {
    if (!active) setBig(false);
  }, [active]);

  // --- render ---------------------------------------------------------------
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* dimmed backdrop behind the big preview */}
      <Animated.View pointerEvents={big ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: INK }, backdropStyle]}>
        <Pressy style={StyleSheet.absoluteFill} hapticKind="none" scaleTo={1} onPress={() => setBig(false)} accessibilityLabel={t('closePreview')} />
      </Animated.View>

      {/* the bar */}
      <Animated.View
        layout={LinearTransition.duration(260).easing(EASE_OUT)}
        style={[
          styles.bar,
          { bottom, left: SIDE + PREVIEW + GAP, right: collapsed ? undefined : SIDE },
        ]}
      >
        <Pressy
          onPress={() => void snap()}
          hapticKind="none"
          accessibilityLabel={t('snapA11y')}
          testID="snap-button"
          style={[styles.button, collapsed ? [styles.buttonSmall, styles.buttonSmallShadow] : [styles.buttonBig, SHADOW], busy && { opacity: 0.85 }]}
        >
          {collapsed ? (
            <Animated.View key="icon" entering={FadeIn.duration(250)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
              <LinearGradient colors={['#FFB7C9', '#FF93AE']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, styles.center]}>
                <View style={styles.smallEdge} pointerEvents="none" />
                <CameraIcon size={32} color={INK} stroke={2.2} />
              </LinearGradient>
            </Animated.View>
          ) : (
            <Animated.View key="label" entering={FadeIn.duration(250)} exiting={FadeOut.duration(120)} style={styles.labelWrap}>
              <View style={styles.edge} pointerEvents="none" />
              <T v="button" style={styles.label}>
                {t('ctaPrefix')}{' '}
              </T>
              <View style={styles.inlineIcon}>
                <CameraIcon size={21} color={INK} stroke={2.3} />
              </View>
              <T v="button" style={styles.label}>
                {' '}{t('ctaSuffix')}
              </T>
            </Animated.View>
          )}
        </Pressy>
      </Animated.View>

      {/* the one camera: small next to the button, or big when tapped */}
      <Animated.View style={[styles.preview, SHADOW, previewStyle]}>
        <Animated.View style={[styles.previewClip, clipStyle]}>
          <Animated.View style={[styles.camBox, { width: large.w, height: large.h }, camStyle]}>
            {granted ? (
              <CameraView
                ref={cam}
                style={StyleSheet.absoluteFill}
                facing="back"
                active={active}
                animateShutter={false}
                onCameraReady={() => setReady(true)}
                onMountError={() => setReady(false)}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.noCam]}>
                <Hero kind="camera" size={Math.round(large.w * 0.3)} shadow={false} />
              </View>
            )}
          </Animated.View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.previewEdge, smallEdgeStyle]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} />
        {!big && (
          <Pressy
            style={StyleSheet.absoluteFill}
            hapticKind="light"
            scaleTo={0.97}
            accessibilityLabel={granted ? t('previewA11y') : t('allowCamera')}
            onPress={() => (granted ? setBig(true) : void requestPerm())}
          />
        )}
        {big && (
          <Animated.View style={[StyleSheet.absoluteFill, bigChrome]} pointerEvents="box-none">
            <Pressy style={styles.close} onPress={() => setBig(false)} accessibilityLabel={t('closePreview')}>
              <CloseIcon size={22} color={INK} />
            </Pressy>
            <Pressy style={styles.shutter} onPress={() => void snap()} hapticKind="none" accessibilityLabel={t('snapA11y')}>
              <View style={styles.shutterInner} />
            </Pressy>
          </Animated.View>
        )}
      </Animated.View>

      {/* the snapped photo flies off toward the food list */}
      {flyUri && (
        <Animated.View pointerEvents="none" style={[styles.fly, SHADOW, { left: small.x, top: small.y }, flyStyle]}>
          <Image source={{ uri: flyUri }} style={styles.flyImg} />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { position: 'absolute', height: BAR_HEIGHT, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  button: {
    height: BAR_HEIGHT - 8,
    borderRadius: 24,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonBig: { paddingHorizontal: 14 },
  buttonSmall: { width: BAR_HEIGHT - 8, borderRadius: 34 },
  buttonSmallShadow: { shadowColor: BLUSH_DEEP, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  edge: { ...ABS, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', borderBottomColor: 'rgba(43,35,80,0.05)' },
  smallEdge: { ...ABS, borderRadius: 34, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderBottomColor: 'rgba(255,255,255,0.1)' },
  labelWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  label: { fontFamily: FONT.displayMedium, fontSize: 16, lineHeight: 21, textAlign: 'center' },
  inlineIcon: { marginTop: -2 },
  preview: { position: 'absolute' },
  previewClip: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: INK },
  camBox: { position: 'absolute', left: 0, top: 0 },
  previewEdge: { ...ABS, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  noCam: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE9EF' },
  close: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    position: 'absolute',
    bottom: 22,
    alignSelf: 'center',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  fly: { position: 'absolute', width: PREVIEW, height: PREVIEW, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF' },
  flyImg: { width: '100%', height: '100%' },
});

export const CAPTURE_LAYOUT = { BAR_HEIGHT, PREVIEW, SIDE, GAP, INK_SOFT };
