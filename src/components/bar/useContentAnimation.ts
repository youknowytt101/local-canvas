// Cosmos' useContentAnimation (hooks/useActionButtonAnimation.js, module 2063; worklets useContentAnimationTs1–5): every
// content of the bar is laid over the others; while the bar goes from one to the next, the one leaving fades and shrinks
// to BAR_CONTENT_MIN_SCALE and the one coming does the reverse, on the bar's activeContentIndex. Only the content being
// gone to takes touches.
import { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { BAR_ACCESSORY_MIN_SCALE, BAR_CONTENT_MIN_SCALE } from './constants';

export type ContentTransition = { fromContentIndex: number; toContentIndex: number };

export function getContentTransitionProgress(activeContentIndex: number, contentIndex: number, fromContentIndex: number, toContentIndex: number) {
  'worklet';
  if (fromContentIndex === toContentIndex) return contentIndex === toContentIndex ? 1 : 0;
  if (contentIndex !== fromContentIndex && contentIndex !== toContentIndex) return 0;
  const transitionProgress = interpolate(activeContentIndex, [fromContentIndex, toContentIndex], [0, 1], Extrapolation.CLAMP);
  return contentIndex === fromContentIndex ? 1 - transitionProgress : transitionProgress;
}

export function useContentAnimation(activeContentIndex: SharedValue<number>, contentTransition: SharedValue<ContentTransition>, contentIndex: number, minScale = BAR_CONTENT_MIN_SCALE) {
  return useAnimatedStyle(() => {
    const { fromContentIndex, toContentIndex } = contentTransition.get();
    const progress = getContentTransitionProgress(activeContentIndex.get(), contentIndex, fromContentIndex, toContentIndex);
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [minScale, 1]) }],
      pointerEvents: toContentIndex === contentIndex ? 'auto' : 'none',
    };
  });
}

// the accessory's icons cross-fade the same way, from BAR_ACCESSORY_MIN_SCALE
export const useAccessoryContentAnimation = (activeContentIndex: SharedValue<number>, contentTransition: SharedValue<ContentTransition>, contentIndex: number) =>
  useContentAnimation(activeContentIndex, contentTransition, contentIndex, BAR_ACCESSORY_MIN_SCALE);
