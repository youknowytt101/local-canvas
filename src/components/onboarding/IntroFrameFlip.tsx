// Cosmos' IntroFrameFlip: the flash of pictures (flash-cut.webp, 2 s) as big as fits the window less 24, aspect 0.7308, centred.
// Once its first frame is there the playback counts: the logo starts 50 ms before the end, the frame scales to 0.85 and fades
// over the last 100 ms, and at 2 s it is done. Near Cosmos: its picture is in the app, here it comes from the computer's
// service, so if it cannot be read the flip is passed over.
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  INTRO_FLASH_CUT_DURATION_MS, INTRO_FLASH_CUT_EXIT_DURATION_MS, INTRO_FLASH_CUT_EXIT_SCALE, INTRO_FLASH_CUT_LOGO_LEAD_MS, introAsset,
} from './introConstants';

const FRAME_ASPECT_RATIO = 0.730816077953715;

export function IntroFrameFlip({ onPlaybackStart, onLogoStart, onComplete }: { onPlaybackStart: () => void; onLogoStart: () => void; onComplete: () => void }) {
  const { width, height } = useWindowDimensions();
  const { rt } = useUnistyles();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const logoStarted = useRef(false);
  const completed = useRef(false);
  const callbacks = useRef({ onPlaybackStart, onLogoStart, onComplete });
  callbacks.current = { onPlaybackStart, onLogoStart, onComplete };

  const frameWidth = Math.min(Math.max(0, width - 24), Math.max(height, rt.screen.height) * FRAME_ASPECT_RATIO);
  const frameHeight = frameWidth / FRAME_ASPECT_RATIO;
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  const startLogo = () => {
    if (logoStarted.current) return;
    logoStarted.current = true;
    callbacks.current.onLogoStart();
  };
  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    startLogo();
    callbacks.current.onComplete();
  };

  useEffect(() => {
    if (!playing) return undefined;
    const logo = setTimeout(startLogo, INTRO_FLASH_CUT_DURATION_MS - INTRO_FLASH_CUT_LOGO_LEAD_MS);
    const exit = setTimeout(() => {
      if (completed.current) return;
      const easing = Easing.in(Easing.ease);
      scale.set(withTiming(INTRO_FLASH_CUT_EXIT_SCALE, { duration: INTRO_FLASH_CUT_EXIT_DURATION_MS, easing }));
      opacity.set(withTiming(0, { duration: INTRO_FLASH_CUT_EXIT_DURATION_MS, easing }));
    }, INTRO_FLASH_CUT_DURATION_MS - INTRO_FLASH_CUT_EXIT_DURATION_MS);
    const done = setTimeout(complete, INTRO_FLASH_CUT_DURATION_MS);
    return () => { clearTimeout(logo); clearTimeout(exit); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[{ width: frameWidth, height: frameHeight }, styles.videoContainer, style]}>
        <Image
          source={{ uri: introAsset('flash-cut.webp') }}
          style={styles.video}
          autoplay
          contentFit="contain"
          onLoad={() => {
            if (started.current) return;
            started.current = true;
            setPlaying(true);
            callbacks.current.onPlaybackStart();
          }}
          onError={complete}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  container: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  videoContainer: { backgroundColor: 'transparent' },
  video: { width: '100%', height: '100%', backgroundColor: 'transparent' },
}));
