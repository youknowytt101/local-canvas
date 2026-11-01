// Cosmos' useHomeChrome (module 3469; worklets useHomeChromeTs1–9 and homeHeaderDismissalTs1, ported as written): the
// home header floats over both pages' lists.
//   - scrolling down pushes it up by as much (clamped to its height, never past the list's own offset); scrolling up
//     brings it back no faster than MAX_HEADER_REVEAL_SPEED (700 px/s) between scroll events (at most 33.3 ms apart)
//   - letting go projects the fling (HOME_HEADER_FLING_PROJECTION_MS 180) and snaps it shown or hidden
//     (getHomeHeaderSnapTarget: shown near the top or when moving up faster than -0.1, hidden when moving down faster
//     than 0.3, else whichever half it is in); the end of the momentum snaps it once more
//   - it fades out over the first 55 % of its height (HEADER_FADE_END) while the top scrim fades in over the rest
//   - only the page on screen moves it; switching to a page scrolled less than the header's height shows it again
import { useCallback, useMemo } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  cancelAnimation, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring,
  type SharedValue,
} from 'react-native-reanimated';

const MAX_HEADER_REVEAL_SPEED = 700;
const MAX_SCROLL_EVENT_GAP_MS = 1000 / 30;
const HEADER_FADE_END = 0.55;
const SETTLED_EPSILON = 0.5;
const HEADER_SPRING = { duration: 275, dampingRatio: 1 };
const HOME_HEADER_FLING_PROJECTION_MS = 180;
const HOME_HEADER_SHOW_VELOCITY_THRESHOLD = -0.1;
const HOME_HEADER_HIDE_VELOCITY_THRESHOLD = 0.3;

export type HomeTabId = 'for-you' | 'following';
export const HOME_TABS: HomeTabId[] = ['for-you', 'following'];

const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(v, min), max);
};

function getHomeHeaderSnapTarget({ headerHeight, headerOffset, projectedScrollY, velocityY }: { headerHeight: number; headerOffset: number; projectedScrollY: number; velocityY: number }) {
  'worklet';
  if (headerHeight <= 0) return 0;
  if (projectedScrollY <= headerHeight || velocityY < HOME_HEADER_SHOW_VELOCITY_THRESHOLD) return 0;
  if (velocityY > HOME_HEADER_HIDE_VELOCITY_THRESHOLD) return headerHeight;
  return headerOffset > headerHeight / 2 ? headerHeight : 0;
}

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent & { timestamp?: number }>;
export type PageScrollHandlers = {
  onScrollBeginDrag: (e: ScrollEvent) => void;
  onScroll: (e: ScrollEvent) => void;
  onScrollEndDrag: (e: ScrollEvent) => void;
  onMomentumScrollEnd: (e: ScrollEvent) => void;
};

// The worklets run on the JS side here, from the list's own scroll events (FlashList drives its recycling from
// onScroll, so it keeps it); what they move are shared values, so the header itself is drawn on the UI thread.
// An event's time is its native timestamp, else when JS received it.
function usePageScrollHandler(pageIndex: number, scrollY: SharedValue<number>, chrome: {
  activeIndex: SharedValue<number>; headerHeight: SharedValue<number>; headerOffset: SharedValue<number>;
  lastScrollTimestamp: SharedValue<number>; dragPageIndex: SharedValue<number>;
}, onScrollJS?: (y: number) => void): PageScrollHandlers {
  const { activeIndex, headerHeight, headerOffset, lastScrollTimestamp, dragPageIndex } = chrome;
  const at = (e: ScrollEvent) => e.nativeEvent.timestamp ?? e.timeStamp ?? 0;
  return useMemo(() => ({
    // useHomeChromeTs1
    onScrollBeginDrag: (e: ScrollEvent) => {
      scrollY.set(Math.max(e.nativeEvent.contentOffset.y, 0));
      if (activeIndex.get() !== pageIndex) return;
      cancelAnimation(headerOffset);
      lastScrollTimestamp.set(at(e));
      dragPageIndex.set(pageIndex);
    },
    // useHomeChromeTs2
    onScroll: (e: ScrollEvent) => {
      const nextScrollY = Math.max(e.nativeEvent.contentOffset.y, 0);
      const previousScrollY = scrollY.get();
      scrollY.set(nextScrollY);
      onScrollJS?.(nextScrollY);
      if (activeIndex.get() !== pageIndex) return;
      const height = headerHeight.get();
      if (height <= 0) return;
      let nextOffset = headerOffset.get();
      if (dragPageIndex.get() === pageIndex) nextOffset = clamp(nextOffset + nextScrollY - previousScrollY, 0, height);
      if (nextOffset > nextScrollY) {
        cancelAnimation(headerOffset);
        nextOffset = nextScrollY;
      }
      if (nextOffset < headerOffset.get()) {
        const now = at(e);
        const elapsedMs = clamp(now - lastScrollTimestamp.get(), 0, MAX_SCROLL_EVENT_GAP_MS);
        const maxRevealDistance = MAX_HEADER_REVEAL_SPEED * (elapsedMs / 1000);
        headerOffset.set(Math.max(nextOffset, headerOffset.get() - maxRevealDistance));
      } else if (nextOffset > headerOffset.get()) {
        headerOffset.set(nextOffset);
      }
      lastScrollTimestamp.set(at(e));
    },
    // useHomeChromeTs3
    onScrollEndDrag: (e: ScrollEvent) => {
      scrollY.set(Math.max(e.nativeEvent.contentOffset.y, 0));
      if (dragPageIndex.get() === pageIndex) dragPageIndex.set(-1);
      if (activeIndex.get() !== pageIndex) return;
      const height = headerHeight.get();
      const currentScrollY = Math.max(e.nativeEvent.contentOffset.y, 0);
      const velocityY = -(e.nativeEvent.velocity?.y ?? 0);
      const projectedScrollY = Math.max(0, currentScrollY + velocityY * HOME_HEADER_FLING_PROJECTION_MS);
      const target = getHomeHeaderSnapTarget({ headerHeight: height, headerOffset: headerOffset.get(), projectedScrollY, velocityY });
      headerOffset.set(withSpring(target, HEADER_SPRING));
    },
    // useHomeChromeTs4
    onMomentumScrollEnd: (e: ScrollEvent) => {
      scrollY.set(Math.max(e.nativeEvent.contentOffset.y, 0));
      if (activeIndex.get() !== pageIndex) return;
      const height = headerHeight.get();
      const currentScrollY = Math.max(e.nativeEvent.contentOffset.y, 0);
      const currentOffset = headerOffset.get();
      if (currentOffset > currentScrollY + SETTLED_EPSILON) {
        headerOffset.set(withSpring(0, HEADER_SPRING));
        return;
      }
      if (currentOffset <= SETTLED_EPSILON || currentOffset >= height - SETTLED_EPSILON) return;
      const target = getHomeHeaderSnapTarget({ headerHeight: height, headerOffset: currentOffset, projectedScrollY: currentScrollY, velocityY: 0 });
      headerOffset.set(withSpring(target, HEADER_SPRING));
    },
  }), [pageIndex]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useHomeChrome(onForYouScroll?: (y: number) => void) {
  const activeIndex = useSharedValue(0);
  const headerHeight = useSharedValue(0);
  const headerOffset = useSharedValue(0);
  const lastScrollTimestamp = useSharedValue(0);
  const dragPageIndex = useSharedValue(-1);
  const forYouScrollY = useSharedValue(0);
  const followingScrollY = useSharedValue(0);
  const chrome = { activeIndex, headerHeight, headerOffset, lastScrollTimestamp, dragPageIndex };

  const forYouScroll = usePageScrollHandler(0, forYouScrollY, chrome, onForYouScroll);
  const followingScroll = usePageScrollHandler(1, followingScrollY, chrome);

  // useHomeChromeTs6: the pager settled on another page
  const onPageChange = useCallback((nextIndex: number) => {
    const previousIndex = activeIndex.get();
    activeIndex.set(nextIndex);
    if (nextIndex === previousIndex) return;
    dragPageIndex.set(-1);
    const destinationScrollY = HOME_TABS[nextIndex] === 'following' ? followingScrollY.get() : forYouScrollY.get();
    if (destinationScrollY < headerHeight.get()) headerOffset.set(withSpring(0, HEADER_SPRING));
  }, [activeIndex, dragPageIndex, followingScrollY, forYouScrollY, headerHeight, headerOffset]);

  const revealHeader = useCallback(() => {
    cancelAnimation(headerOffset);
    headerOffset.set(withSpring(0, HEADER_SPRING));
  }, [headerOffset]);

  // useHomeChromeTs7 / Ts8
  const headerStyle = useAnimatedStyle(() => {
    const height = headerHeight.get();
    return {
      top: -headerOffset.get(),
      opacity: height <= 0 ? 1 : interpolate(headerOffset.get(), [0, height * HEADER_FADE_END], [1, 0], Extrapolation.CLAMP),
    };
  });
  // useHomeChromeTs9
  const scrimStyle = useAnimatedStyle(() => {
    const height = headerHeight.get();
    return { opacity: height <= 0 ? 0 : interpolate(headerOffset.get(), [height * HEADER_FADE_END, height], [0, 1], Extrapolation.CLAMP) };
  });

  return { headerHeight, headerOffset, forYouScroll, followingScroll, onPageChange, revealHeader, headerStyle, scrimStyle };
}
