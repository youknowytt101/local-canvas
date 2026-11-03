// Cosmos' IntroScreen (routes.GetStarted; the first time the app opens signed out, getHasSeenIntro): four pages one over
// another, moved by a spring (750 ms, damping ratio 0.85) with the button, each fading as it leaves:
//   - first: the flash of pictures, the logo over its end, and 1433 ms into the logo the pictures burst out, with the line at
//     the top and the footer coming in; a haptic every 100 ms over the flash and two beats at the burst
//     (useIntroAnimationHaptics)
//   - then ImageStack, ImageGrid and SlideCarousel; the last page's background fades to olive over 750 ms and its words turn white
// The last button fades the whole page out (400 ms) and goes on to signing in.
// Near Cosmos: the app has no sign-up, so it goes on to the login page rather than Email; the pictures and the animation
// come from the computer's service, so they are fetched first and this needs the service's address, which is asked before it.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { Image } from 'expo-image';
import type { AnimationObject } from 'lottie-react-native';
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import {
  INTRO_EXPLOSION_GHOST_NOTE_LEAD_MS, INTRO_FLASH_CUT_DURATION_MS, INTRO_FLASH_CUT_LOGO_LEAD_MS, INTRO_STEP3_START_DELAY_MS,
  INTRO_VIDEO_HAPTIC_EXTENSION_MS, INTRO_VIDEO_HAPTIC_INTERVAL_MS, introAsset, playIntroExplosionGhostPulse, playIntroExplosionImpactPulse, playIntroVideoBeat,
} from '../../components/onboarding/introConstants';
import { IntroFooter } from '../../components/onboarding/IntroFooter';
import { IntroFrameFlip } from '../../components/onboarding/IntroFrameFlip';
import { IntroLogoLottie } from '../../components/onboarding/IntroLogoLottie';
import { ImageGrid, ImageStack, SlideCarousel } from '../../components/onboarding/IntroPages';
import { IntroTopText } from '../../components/onboarding/IntroTopText';
import { SCATTERED_IMAGE_FILES, ScatteredImages } from '../../components/onboarding/ScatteredImages';

const NUMBER_OF_STEPS = 4;
const LAST_STEP_INDEX = 3;
const SLIDE_BG_COLORS = ['rgb(81, 81, 43)', 'rgb(82, 83, 76)'];
const PAGE_TOP_GAP = 16;
const PAGE_BOTTOM_GAP = 8;
const PRELOADED = [
  'flash-cut.webp', ...SCATTERED_IMAGE_FILES, 'stack-image-1.png', 'stack-image-2.png', 'stack-image-3.png',
  'grid-image-1.png', 'grid-image-2.png', 'grid-image-3.png', 'grid-image-4.png', 'slide-image-1.png',
];

type IntroState = { flipDone: boolean; hapticRunId: number; logoStarted: boolean; step3Started: boolean };
const INITIAL_STATE: IntroState = { flipDone: false, hapticRunId: 0, logoStarted: false, step3Started: false };
type IntroAction = { type: 'completeFlip' | 'startHaptics' | 'startLogo' | 'startStep3' };
function reduceIntroAnimation(state: IntroState, action: IntroAction): IntroState {
  switch (action.type) {
    case 'completeFlip': return { ...state, flipDone: true, logoStarted: true };
    case 'startHaptics': return { ...state, hapticRunId: state.hapticRunId + 1 };
    case 'startLogo': return { ...state, logoStarted: true };
    case 'startStep3': return { ...state, step3Started: true };
    default: return state;
  }
}

function useIntroAnimationHaptics(startRunId: number) {
  useEffect(() => {
    if (startRunId === 0) return undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const span = INTRO_FLASH_CUT_DURATION_MS + INTRO_VIDEO_HAPTIC_EXTENSION_MS;
    const beats = Math.floor(span / INTRO_VIDEO_HAPTIC_INTERVAL_MS);
    const logoAt = INTRO_FLASH_CUT_DURATION_MS - INTRO_FLASH_CUT_LOGO_LEAD_MS;
    for (let i = 0; i <= beats; i++) timers.push(setTimeout(playIntroVideoBeat, i * INTRO_VIDEO_HAPTIC_INTERVAL_MS));
    timers.push(setTimeout(playIntroExplosionGhostPulse, logoAt + Math.max(0, INTRO_STEP3_START_DELAY_MS - INTRO_EXPLOSION_GHOST_NOTE_LEAD_MS)));
    timers.push(setTimeout(playIntroExplosionImpactPulse, logoAt + INTRO_STEP3_START_DELAY_MS));
    return () => timers.forEach(clearTimeout);
  }, [startRunId]);
}

function Page({ index, scrollY, screenHeight, contentTopInset = 0, contentBottomInset = 0, children }: {
  index: number; scrollY: SharedValue<number>; screenHeight: number; contentTopInset?: number; contentBottomInset?: number; children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const offset = index * screenHeight;
    return { opacity: interpolate(scrollY.get(), [offset - screenHeight, offset, offset + screenHeight], [0, 1, 0], 'clamp') };
  });
  return (
    <Animated.View style={[{ height: screenHeight }, style]}>
      {index > 0 ? <View style={[styles.pageContent, { paddingTop: contentTopInset + PAGE_TOP_GAP, paddingBottom: contentBottomInset + PAGE_BOTTOM_GAP }]}>{children}</View> : children}
    </Animated.View>
  );
}

export function IntroScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { theme, rt } = useUnistyles();
  const windowHeight = useWindowDimensions().height;
  const screenHeight = Math.max(windowHeight, rt.screen.height);
  const [state, dispatch] = useReducer(reduceIntroAnimation, INITIAL_STATE);
  const [activeStep, setActiveStep] = useState(0);
  const [topTextHeight, setTopTextHeight] = useState(0);
  const [controlsHeight, setControlsHeight] = useState(0);
  // the logo's animation, and all the pictures, so that nothing waits for the network once it has begun
  const [ready, setReady] = useState(false);
  const [logo, setLogo] = useState<AnimationObject | null>(null);
  const scrollY = useSharedValue(0);
  const bgProgress = useSharedValue(0);
  const exitOpacity = useSharedValue(1);
  useIntroAnimationHaptics(state.hapticRunId);

  useEffect(() => {
    let gone = false;
    void (async () => {
      const [animation] = await Promise.all([
        fetch(introAsset('logo.json')).then((r) => r.json() as Promise<AnimationObject>).catch(() => null),
        Image.prefetch(PRELOADED.map(introAsset)).catch(() => false),
      ]);
      if (gone) return;
      setLogo(animation);
      setReady(true);
    })();
    return () => { gone = true; };
  }, []);

  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -scrollY.get() }] }));
  const backgroundColors = useMemo(() => [theme.colors.background, SLIDE_BG_COLORS[0], SLIDE_BG_COLORS[1], theme.colors.background], [theme.colors.background]);
  const bgColor = useDerivedValue(() => interpolateColor(bgProgress.get(), [0, 1, 2, 3], backgroundColors));
  const containerStyle = useAnimatedStyle(() => ({ backgroundColor: bgColor.get(), opacity: exitOpacity.get() }));

  const goToStep = (step: number) => {
    setActiveStep(step);
    scrollY.set(withSpring(step * screenHeight, { duration: 750, dampingRatio: 0.85 }));
    bgProgress.set(withTiming(step === LAST_STEP_INDEX ? 1 : 0, { duration: 750 }));
  };
  const next = () => {
    if (activeStep < LAST_STEP_INDEX) { goToStep(activeStep + 1); return; }
    const goOn = () => navigation.navigate('Login');
    exitOpacity.set(withTiming(0, { duration: 400 }, () => { scheduleOnRN(goOn); }));
  };

  const white = activeStep === LAST_STEP_INDEX;
  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {state.step3Started ? <IntroTopText activeStep={activeStep} useSlideWhiteTheme={white} onLayout={(e) => setTopTextHeight(e.nativeEvent.layout.height)} /> : null}
      <Animated.View style={[styles.pager, pagerStyle]}>
        <Page index={0} scrollY={scrollY} screenHeight={screenHeight}>
          {state.step3Started ? <ScatteredImages /> : null}
          {ready && !state.flipDone ? (
            <IntroFrameFlip
              onPlaybackStart={() => dispatch({ type: 'startHaptics' })}
              onLogoStart={() => dispatch({ type: 'startLogo' })}
              onComplete={() => dispatch({ type: 'completeFlip' })}
            />
          ) : null}
          <IntroLogoLottie start={state.logoStarted} source={logo} onStep3Start={() => dispatch({ type: 'startStep3' })} />
        </Page>
        <Page index={1} scrollY={scrollY} screenHeight={screenHeight} contentTopInset={topTextHeight} contentBottomInset={controlsHeight}><ImageStack /></Page>
        <Page index={2} scrollY={scrollY} screenHeight={screenHeight} contentTopInset={topTextHeight} contentBottomInset={controlsHeight}><ImageGrid /></Page>
        <Page index={3} scrollY={scrollY} screenHeight={screenHeight} contentTopInset={topTextHeight} contentBottomInset={controlsHeight}><SlideCarousel /></Page>
      </Animated.View>
      {state.step3Started ? (
        <IntroFooter
          onStart={next} activeStep={activeStep} numberOfSteps={NUMBER_OF_STEPS} useSlideWhiteTheme={white}
          onControlsLayout={(e) => setControlsHeight(e.nativeEvent.layout.height)} lastStepIndex={LAST_STEP_INDEX}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create(() => ({
  container: { flex: 1 },
  pager: { ...StyleSheet.absoluteFillObject },
  pageContent: { flex: 1 },
}));
