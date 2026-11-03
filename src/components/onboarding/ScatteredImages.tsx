// Cosmos' ScatteredImages (worklet ScatteredImagesTsx1, the numbers as they are): eight pictures burst from the middle of a
// stage 0.52 of the screen high to their places over 1200 ms (bezier 0.16, 1, 0.3, 1), fading in over 750 ms with a soft
// haptic; once there each floats 3 px up or down and back for ever, each with its own delay and length.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { INTRO_TILE_EXPLOSION_DURATION_MS, introAsset, playIntroScatteredRevealPulse } from './introConstants';

const STAGE_HEIGHT_RATIO = 0.52;
const TILE_FADE_MS = 750;
const TILE_FLOAT_OFFSET_PX = 3;
const TILE_ASPECT_RATIO = 0.8;
const TILE_INITIAL_STATE = { centerX: 0.5, centerY: 0.5, width: 0.05, opacity: 0 };

type Tile = {
  id: string; file: string; zIndex: number; floatDirection: 1 | -1; floatDelayMs: number; floatDurationMs: number;
  end: { centerX: number; centerY: number; width: number; opacity: number };
};
const TILES: Tile[] = ([
  { id: 'yellow-top-left', file: 'stop-flash-image-14.png', zIndex: 2, floatDirection: -1, floatDelayMs: 300, floatDurationMs: 3450, end: { centerX: 0.168, centerY: 0.23609, width: 0.136, opacity: 1 } },
  { id: 'yellow-top-right', file: 'stop-flash-image-9.png', zIndex: 2, floatDirection: 1, floatDelayMs: 400, floatDurationMs: 3600, end: { centerX: 0.869, centerY: 0.29822, width: 0.102, opacity: 1 } },
  { id: 'yellow-bottom-left', file: 'stop-flash-image-18.png', zIndex: 2, floatDirection: -1, floatDelayMs: 500, floatDurationMs: 3750, end: { centerX: 0.16, centerY: 0.67898, width: 0.146, opacity: 1 } },
  { id: 'yellow-bottom-right', file: 'stop-flash-image-8.png', zIndex: 2, floatDirection: 1, floatDelayMs: 600, floatDurationMs: 3900, end: { centerX: 0.8425, centerY: 0.69551, width: 0.125, opacity: 1 } },
  { id: 'green', file: 'stop-flash-image-12.png', zIndex: 3, floatDirection: 1, floatDelayMs: 100, floatDurationMs: 3150, end: { centerX: 0.393, centerY: 0.12551, width: 0.202, opacity: 1 } },
  { id: 'red', file: 'stop-flash-image-3.png', zIndex: 3, floatDirection: -1, floatDelayMs: 200, floatDurationMs: 3300, end: { centerX: 0.6345, centerY: 0.21158, width: 0.169, opacity: 1 } },
  { id: 'blue', file: 'stop-flash-image-4.png', zIndex: 3, floatDirection: -1, floatDelayMs: 0, floatDurationMs: 3000, end: { centerX: 0.321, centerY: 0.80609, width: 0.11, opacity: 1 } },
  { id: 'stop-flash', file: 'hero-landing-image.png', zIndex: 3, floatDirection: 1, floatDelayMs: 700, floatDurationMs: 4050, end: { centerX: 0.569, centerY: 0.79868, width: 0.258, opacity: 1 } },
] as Tile[]).sort((a, b) => a.zIndex - b.zIndex);

export const SCATTERED_IMAGE_FILES = TILES.map((t) => t.file);

function ScatteredTile({ config, explosionProgress, opacityProgress, floating, stageTop, stageHeight, stageWidth }: {
  config: Tile; explosionProgress: SharedValue<number>; opacityProgress: SharedValue<number>; floating: boolean;
  stageTop: number; stageHeight: number; stageWidth: number;
}) {
  const floatProgress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(floatProgress);
    floatProgress.set(0);
    if (!floating) return;
    floatProgress.set(withDelay(config.floatDelayMs, withRepeat(withTiming(1, { duration: config.floatDurationMs, easing: Easing.inOut(Easing.ease) }), -1, true)));
  }, [config.floatDelayMs, config.floatDurationMs, floatProgress, floating]);
  const style = useAnimatedStyle(() => {
    const explosion = explosionProgress.get();
    const opacity = opacityProgress.get();
    const floatingOffset = interpolate(floatProgress.get(), [0, 1], [0, TILE_FLOAT_OFFSET_PX], 'clamp') * config.floatDirection;
    const initialWidth = TILE_INITIAL_STATE.width * stageWidth;
    const initialHeight = initialWidth / TILE_ASPECT_RATIO;
    const endWidth = config.end.width * stageWidth;
    const endHeight = endWidth / TILE_ASPECT_RATIO;
    return {
      left: interpolate(explosion, [0, 1], [TILE_INITIAL_STATE.centerX * stageWidth - initialWidth / 2, config.end.centerX * stageWidth - endWidth / 2], 'clamp'),
      top: interpolate(explosion, [0, 1], [stageTop + TILE_INITIAL_STATE.centerY * stageHeight - initialHeight / 2, stageTop + config.end.centerY * stageHeight - endHeight / 2], 'clamp'),
      width: interpolate(explosion, [0, 1], [initialWidth, endWidth], 'clamp'),
      height: interpolate(explosion, [0, 1], [initialHeight, endHeight], 'clamp'),
      opacity: interpolate(opacity, [0, 1], [TILE_INITIAL_STATE.opacity, config.end.opacity], 'clamp'),
      transform: [{ translateY: floatingOffset }],
      zIndex: config.zIndex,
    };
  });
  return (
    <Animated.View style={[styles.tile, style]}>
      <Image source={{ uri: introAsset(config.file) }} style={styles.fill} contentFit="cover" />
    </Animated.View>
  );
}

export function ScatteredImages() {
  const { width, height } = useWindowDimensions();
  const { rt } = useUnistyles();
  const explosionProgress = useSharedValue(0);
  const opacityProgress = useSharedValue(0);
  const [floating, setFloating] = useState(false);
  const screenHeight = Math.max(height, rt.screen.height);
  const stageHeight = screenHeight * STAGE_HEIGHT_RATIO;
  const stageTop = (screenHeight - stageHeight) / 2;

  useEffect(() => {
    playIntroScatteredRevealPulse();
    explosionProgress.set(withTiming(1, { duration: INTRO_TILE_EXPLOSION_DURATION_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
    opacityProgress.set(withTiming(1, { duration: TILE_FADE_MS, easing: Easing.inOut(Easing.ease) }));
    const t = setTimeout(() => setFloating(true), INTRO_TILE_EXPLOSION_DURATION_MS);
    return () => clearTimeout(t);
  }, [explosionProgress, opacityProgress]);

  return (
    <View style={styles.root} pointerEvents="none">
      {TILES.map((config) => (
        <ScatteredTile
          key={config.id} config={config} explosionProgress={explosionProgress} opacityProgress={opacityProgress}
          floating={floating} stageTop={stageTop} stageHeight={stageHeight} stageWidth={width}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  root: { ...StyleSheet.absoluteFillObject },
  tile: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%', transform: [{ scale: 1.03 }] },
}));
