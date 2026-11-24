import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useLocationStore } from '@/stores/location';
import { useOnboardingStore } from '@/stores/onboarding';
import { colors } from '@/theme/tokens';

/** Composition size of assets/logo/Splash.json (412 x 917). */
const ART_WIDTH = 412;
const ART_HEIGHT = 917;
/** The 3.68s composition plays in ~2.1s. */
const SPEED = 1.75;

export default function SplashRoute() {
  const { width, height } = useWindowDimensions();
  // Cover the viewport at every breakpoint: scale up until both axes are filled,
  // then let the root clip the overflow.
  const scale = Math.max(width / ART_WIDTH, height / ART_HEIGHT);
  const frame = { width: ART_WIDTH * scale, height: ART_HEIGHT * scale };

  const routed = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  /**
   * First run: intro slides -> sign up / sign in -> location.
   * After that: straight into the app, or to the location step if the town was
   * never chosen. Both stores are persisted, so wait for them to hydrate.
   */
  const finish = useCallback(() => {
    const decide = () => {
      if (routed.current) return;
      if (!useOnboardingStore.persist.hasHydrated() || !useLocationStore.persist.hasHydrated()) return;
      routed.current = true;
      if (!useOnboardingStore.getState().completed) { router.replace('/onboarding'); return; }
      const location = useLocationStore.getState();
      if (!location.town && !location.skipped) { router.replace('/location'); return; }
      router.replace('/home');
    };

    decide();
    if (routed.current) return;

    const unsubscribers = [
      useOnboardingStore.persist.onFinishHydration(decide),
      useLocationStore.persist.onFinishHydration(decide),
    ];
    // Never leave someone stuck on the splash if a storage read stalls.
    timers.current.push(setTimeout(() => {
      decide();
      if (!routed.current) {
        routed.current = true;
        router.replace(useOnboardingStore.getState().completed ? '/home' : '/onboarding');
      }
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    }, 1500));
  }, []);

  return (
    <View style={styles.root}>
      <View style={frame}>
        <LottieView
          source={require('@/assets/logo/Splash.json')}
          autoPlay
          loop={false}
          speed={SPEED}
          resizeMode="cover"
          style={styles.fill}
          webStyle={styles.fill}
          onAnimationFinish={finish}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
