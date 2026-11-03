// Cosmos' IntroLogoLottie with ThemeLottieView: the logo animation in the middle (240 high, 20 in from the sides), every fill
// in the theme's primary, once it is told to start; 1433 ms in the rest of the first page begins (onStep3Start).
// Near Cosmos: the animation is iOS 2.64's SplashLogoWordmark (the same composition, COSMOS-Onboarding-V1-Logo, 197 frames at
// 60), read from the computer's service; if that fails the page goes on without it.
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { INTRO_LOTTIE_DURATION_MS, INTRO_STEP3_START_DELAY_MS } from './introConstants';

export function IntroLogoLottie({ start, source, onStep3Start }: { start: boolean; source: AnimationObject | null; onStep3Start: () => void }) {
  const { theme } = useUnistyles();
  const callback = useRef(onStep3Start);
  callback.current = onStep3Start;
  useEffect(() => {
    if (!start) return undefined;
    const t = setTimeout(() => callback.current(), source ? INTRO_STEP3_START_DELAY_MS : 0);
    return () => clearTimeout(t);
  }, [start, source]);
  if (!start || !source) return null;
  return (
    <View style={styles.container} pointerEvents="none">
      <LottieView
        source={source}
        autoPlay
        loop={false}
        duration={INTRO_LOTTIE_DURATION_MS}
        style={styles.lottie}
        colorFilters={[{ keypath: '**.Fill 1', color: theme.colors.primary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'stretch', paddingHorizontal: 20 },
  lottie: { width: '100%', height: 240 },
}));
