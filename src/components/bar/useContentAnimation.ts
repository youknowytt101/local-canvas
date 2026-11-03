// Cosmos' useContentAnimation (hooks/useActionButtonAnimation.js, module 2063; worklets useContentAnimationTs1–5): every
// content of the bar is laid over the others; while the bar goes from one to the next, the one leaving fades and shrinks
// to BAR_CONTENT_MIN_SCALE and the one coming does the reverse, on the bar's activeContentIndex. Only the content being
// gone to takes touches.
import { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { BAR_ACCESSORY_MIN_SCALE, BAR_ACCESSORY_TRANSLATE_X, BAR_CONTENT_MIN_SCALE } from './constants';

export type ContentTransition = { fromContentIndex: number; toContentIndex: number };

export function getContentTransitionProgress(activeContentIndex: number, contentIndex: number, fromContentIndex: number, toContentIndex: number) {
  'worklet';
  if (fromContentIndex === toContentIndex) return contentIndex === toContentIndex ? 1 : 0;
  if (contentIndex !== fromContentIndex && contentIndex !== toContentIndex) return 0;
  const transitionProgress = interpolate(activeContentIndex, [fromContentIndex, toContentIndex], [0, 1], Extrapolation.CLAMP);
  return contentIndex === fromContentIndex ? 1 - transitionProgress : transitionProgress;
}

// useContentAnimationTs2 / 3
export function useContentAnimation(activeContentIndex: SharedValue<number>, contentTransition: SharedValue<ContentTransition>, contentIndex: number) {
  return useAnimatedStyle(() => {
    const { fromContentIndex, toContentIndex } = contentTransition.get();
    const progress = getContentTransitionProgress(activeContentIndex.get(), contentIndex, fromContentIndex, toContentIndex);
    return {
      opacity: progress,
      transform: [{ scale: interpolate(progress, [0, 1], [BAR_CONTENT_MIN_SCALE, 1]) }],
      pointerEvents: toContentIndex === contentIndex ? 'auto' : 'none',
    };
  });
}

// useActionButtonAnimation (useContentAnimationTs4 / 5): a round button's content comes in from
// BAR_ACCESSORY_TRANSLATE_X towards the pill ('left' from the right of its place, 'right' from the left), growing from
// BAR_ACCESSORY_MIN_SCALE as it fades in
export function useActionButtonAnimation(activeContentIndex: SharedValue<number>, contentTransition: SharedValue<ContentTransition>, contentIndex: number, position: 'left' | 'right') {
  const initialTranslateX = position === 'left' ? BAR_ACCESSORY_TRANSLATE_X : -BAR_ACCESSORY_TRANSLATE_X;
  return useAnimatedStyle(() => {
    const { fromContentIndex, toContentIndex } = contentTransition.get();
    const progress = getContentTransitionProgress(activeContentIndex.get(), contentIndex, fromContentIndex, toContentIndex);
    return {
      opacity: interpolate(progress, [0, 1], [0, 1]),
      transform: [
        { translateX: interpolate(progress, [0, 1], [initialTranslateX, 0]) },
        { scale: interpolate(progress, [0, 1], [BAR_ACCESSORY_MIN_SCALE, 1]) },
      ],
      pointerEvents: toContentIndex === contentIndex ? 'auto' : 'none',
    };
  });
}
