import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { load, setState, useStore } from './src/store';
import { startAnalyzer } from './src/analyzer';
import { startWidgetSync } from './src/widgets/sync';
import { initIap } from './src/iap';
import { Home } from './src/screens/Home';
import { Onboarding } from './src/screens/Onboarding';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [fontsLoaded] = useFonts({
    'Fredoka-Medium': require('./assets/fonts/Fredoka-Medium.ttf'),
    'Fredoka-SemiBold': require('./assets/fonts/Fredoka-SemiBold.ttf'),
    'Fredoka-Bold': require('./assets/fonts/Fredoka-Bold.ttf'),
    'Nunito-SemiBold': require('./assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-ExtraBold': require('./assets/fonts/Nunito-ExtraBold.ttf'),
  });
  const loaded = useStore((s) => s.loaded);
  const onboarded = useStore((s) => s.onboarded);
  const [justOnboarded, setJustOnboarded] = useState(false);

  useEffect(() => {
    void load().then(() => {
      startAnalyzer();
      startWidgetSync();
      void initIap();
    });
  }, []);

  const ready = fontsLoaded && loaded;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {onboarded ? (
          <Animated.View key="home" entering={FadeIn.duration(400)} style={styles.root}>
            <Home showPaywallOnMount={justOnboarded} />
          </Animated.View>
        ) : (
          <Onboarding
            onDone={() => {
              setJustOnboarded(true);
              setState({ onboarded: true });
            }}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
