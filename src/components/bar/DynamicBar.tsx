// Cosmos' DynamicBar (module 2056): one floating pill over every screen, drawn outside the navigators (RootNavigator puts
// it after the stack) and fed by useTabBarStore / useBarStore. It changes shape for what it holds (getBarTargets: the
// tabs, the search field, the element's actions or its scroll-to-top, a collection's actions, 看相似, organizing, the
// scroll-to-top of a collection's similar page), springs between sizes (TAB_BAR_SIZE_SPRING_CONFIG;
// GLOBAL_SEARCH_MORPH_(EXIT_)SPRING_CONFIG into / out of search) and cross-fades its contents
// (BAR_CONTENT_SHOW_DURATION). Beside it is a round accessory (search / close). While searching, both ride on the
// keyboard (getGlobalSearchKeyboardShift) and widen to GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET.
// As in Cosmos the targets are worked out from the stores whenever they change (syncAnimatedState, subscribed to
// both), not on the next render; the width and height spring only when they change, the visibility only when hiding
// or showing does, the rest every time.
// Layers, as Cosmos' styles: the eased bottom gradient (BAR_GRADIENT_HEIGHT, background 00 → 66), then for the pill and
// the accessory a shadow (BAR_SHADOW), the pillElevated content and a .5 surfaceBorder inner border.
// Phones only: the tablet sizes (TAB_BAR_DEFAULT_WIDTH from TAB_BAR_TABLET_BREAKPOINT) are not used (no iPad build).
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Easing, useWindowDimensions, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { preloadGlobalSearch } from '../../lib/globalSearch';
import { useBarStore } from '../../stores/useBarStore';
import { useTabBarStore } from '../../stores/useTabBarStore';
import {
  BAR_BOTTOM_OFFSET, BAR_CONTENT_INDEX, BAR_CONTENT_SHOW_DURATION, BAR_ENTER_TRANSLATE_Y, BAR_GRADIENT_HEIGHT,
  BAR_HIDDEN_SCREENS, BAR_HIDE_DURATION, BAR_PILL_RADIUS, BAR_SHADOW, BAR_SHOW_DURATION, GLOBAL_SEARCH_ACTION_GAP,
  GLOBAL_SEARCH_ACTION_SIZE, GLOBAL_SEARCH_BAR_HEIGHT, GLOBAL_SEARCH_HORIZONTAL_INSET, GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET,
  GLOBAL_SEARCH_MORPH_EXIT_SPRING_CONFIG, GLOBAL_SEARCH_MORPH_SPRING_CONFIG, TAB_BAR_ACTION_GAP, TAB_BAR_CLUSTER_ORGANIZE_COMPACT_WIDTH,
  TAB_BAR_CLUSTER_ORGANIZE_WIDTH, TAB_BAR_CLUSTER_SEE_SIMILAR_HEIGHT, TAB_BAR_CLUSTER_SEE_SIMILAR_WIDTH, TAB_BAR_CLUSTER_USER_WIDTH,
  TAB_BAR_ELEMENT_ACTION_BAR_WIDTH, TAB_BAR_ELEMENT_SCROLL_TO_TOP_SIZE, TAB_BAR_HEIGHT_DEFAULT, TAB_BAR_HEIGHT_TALL, TAB_BAR_HOME_HEIGHT,
  TAB_BAR_SEARCH_ACTION_SIZE, TAB_BAR_SIZE_SPRING_CONFIG, getEdgeToEdgeBarWidth, getGlobalSearchBarWidth, getGlobalSearchKeyboardShift,
} from './constants';
import { ClusterSeeSimilarTabBarContent, ClusterTabBarContent, OrganizeClusterTabBarContent } from './ClusterTabBarContent';
import { DefaultTabsContent } from './DefaultTabsContent';
import { DynamicBarSearchAction } from './DynamicBarSearchAction';
import { ElementActionTabBarContent, ElementSideActions, ScrollToTopTabBarContent } from './ElementActionTabBarContent';
import { GlobalSearchTabBarContent } from './GlobalSearchTabBarContent';
import type { ContentTransition } from './useContentAnimation';

type Targets = {
  isGlobalSearch: boolean; isHidden: boolean; contentIndex: number; width: number; height: number; translateX: number;
  accessorySize: number; accessoryRight: number; searchModeProgress: number; visibility: number; accessoryVisibility: number;
};

// getBarTargets (phones: the tablet sizes from TAB_BAR_TABLET_BREAKPOINT are not used, there is no iPad build)
function getBarTargets(windowWidth: number): Targets {
  const { activeState: state, tabBarSuppressed, activeScreen, elementViewerBarState } = useBarStore.getState();
  const hasTabs = useTabBarStore.getState().tabNavProps != null;
  const type = state.type;
  // isBarHidden (and here: no bar before the tabs are there)
  const isHidden = !hasTabs || tabBarSuppressed || (activeScreen != null && BAR_HIDDEN_SCREENS.has(activeScreen));
  const isGlobalSearch = type === 'global-search';
  // getSize
  let width: number;
  let height: number;
  if (type === 'global-search') {
    width = getGlobalSearchBarWidth(windowWidth, GLOBAL_SEARCH_HORIZONTAL_INSET);
    height = GLOBAL_SEARCH_BAR_HEIGHT;
  } else if (type === 'element') {
    // the viewer: the 162 wide 保存, or the round scroll-to-top past the carousel
    width = elementViewerBarState?.mode === 'scrollToTop' ? TAB_BAR_ELEMENT_SCROLL_TO_TOP_SIZE : TAB_BAR_ELEMENT_ACTION_BAR_WIDTH;
    height = TAB_BAR_HEIGHT_DEFAULT;
  } else if (type === 'scroll-to-top') {
    width = TAB_BAR_ELEMENT_SCROLL_TO_TOP_SIZE;
    height = TAB_BAR_HEIGHT_DEFAULT;
  } else if (type === 'cluster') {
    width = TAB_BAR_CLUSTER_USER_WIDTH;
    height = TAB_BAR_HEIGHT_TALL;
  } else if (type === 'cluster-see-similar') {
    width = TAB_BAR_CLUSTER_SEE_SIMILAR_WIDTH;
    height = TAB_BAR_CLUSTER_SEE_SIMILAR_HEIGHT;
  } else if (type === 'organize') {
    width = state.isFromSubCluster ? TAB_BAR_CLUSTER_ORGANIZE_COMPACT_WIDTH : TAB_BAR_CLUSTER_ORGANIZE_WIDTH;
    height = TAB_BAR_HEIGHT_TALL;
  } else {
    // getDefaultBarWidth: room left for the accessory beside it
    width = getEdgeToEdgeBarWidth(windowWidth, GLOBAL_SEARCH_HORIZONTAL_INSET, TAB_BAR_ACTION_GAP, TAB_BAR_SEARCH_ACTION_SIZE);
    height = TAB_BAR_HOME_HEIGHT;
  }
  // getTranslateX: the default pill and the search field are moved left by half the accessory and its gap
  // (getDefaultBarOffsetX / getEdgeToEdgeBarOffsetX), the rest are centred
  const translateX = isGlobalSearch ? -(GLOBAL_SEARCH_ACTION_GAP + GLOBAL_SEARCH_ACTION_SIZE) / 2
    : type === 'default' ? -(TAB_BAR_ACTION_GAP + TAB_BAR_SEARCH_ACTION_SIZE) / 2 : 0;
  return {
    isGlobalSearch,
    isHidden,
    contentIndex: BAR_CONTENT_INDEX[type],
    width,
    height,
    translateX,
    accessorySize: isGlobalSearch ? GLOBAL_SEARCH_ACTION_SIZE : TAB_BAR_SEARCH_ACTION_SIZE,
    accessoryRight: GLOBAL_SEARCH_HORIZONTAL_INSET, // getAccessoryRight
    searchModeProgress: isGlobalSearch ? 1 : 0,
    visibility: isHidden ? 0 : 1,
    accessoryVisibility: !isHidden && (type === 'default' || isGlobalSearch) ? 1 : 0,
  };
}

// easeGradient (module 2059) between background 00 and 66: extraColorStopsPerTransition 12, so 14 stops at i / 13, each
// the colour eased by Easing.bezier(0.42, 0, 0.58, 1) (its default); here the alpha of each stop
const EXTRA_COLOR_STOPS = 12;
const GRADIENT_EASING = Easing.bezier(0.42, 0, 0.58, 1);
const LOCATIONS = Array.from({ length: EXTRA_COLOR_STOPS + 2 }, (_, i) => i / (EXTRA_COLOR_STOPS + 1));
const EASED = LOCATIONS.map((t) => GRADIENT_EASING(t));
const easeGradient = (background: string) =>
  EASED.map((f) => `${background}${Math.round(0x66 * f).toString(16).padStart(2, '0')}`);

export function DynamicBar() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const hasTabs = useTabBarStore((s) => s.tabNavProps != null);
  const shown = useRef<Targets | null>(null);
  if (shown.current == null) shown.current = getBarTargets(windowWidth);
  const initial = shown.current;

  const containerWidth = useSharedValue(initial.width);
  const containerHeight = useSharedValue(initial.height);
  const containerTranslateX = useSharedValue(initial.translateX);
  const accessorySize = useSharedValue(initial.accessorySize);
  const accessoryRight = useSharedValue(initial.accessoryRight);
  const visibilityProgress = useSharedValue(initial.visibility);
  const accessoryVisibilityProgress = useSharedValue(initial.accessoryVisibility);
  const searchModeProgress = useSharedValue(initial.searchModeProgress);
  const activeContentIndex = useSharedValue(initial.contentIndex);
  const contentTransition = useSharedValue<ContentTransition>({ fromContentIndex: initial.contentIndex, toContentIndex: initial.contentIndex });
  const { height: keyboardHeight, progress: keyboardProgress } = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (hasTabs) preloadGlobalSearch();
  }, [hasTabs]);

  // syncAnimatedState, run on every change of either store (and of the window's width)
  useEffect(() => {
    const syncAnimatedState = () => {
      const prev = shown.current!;
      const next = getBarTargets(windowWidth);
      shown.current = next;
      if (prev.contentIndex !== next.contentIndex) {
        contentTransition.set({ fromContentIndex: prev.contentIndex, toContentIndex: next.contentIndex });
        activeContentIndex.set(withTiming(next.contentIndex, { duration: BAR_CONTENT_SHOW_DURATION }));
      }
      const spring = next.isGlobalSearch ? GLOBAL_SEARCH_MORPH_SPRING_CONFIG
        : prev.isGlobalSearch ? GLOBAL_SEARCH_MORPH_EXIT_SPRING_CONFIG : TAB_BAR_SIZE_SPRING_CONFIG;
      if (prev.width !== next.width) containerWidth.set(withSpring(next.width, spring));
      if (prev.height !== next.height) containerHeight.set(withSpring(next.height, spring));
      containerTranslateX.set(withSpring(next.translateX, spring));
      accessorySize.set(withSpring(next.accessorySize, spring));
      accessoryRight.set(withSpring(next.accessoryRight, spring));
      searchModeProgress.set(withSpring(next.searchModeProgress, spring));
      const duration = next.isHidden ? BAR_HIDE_DURATION : BAR_SHOW_DURATION;
      if (prev.isHidden !== next.isHidden) visibilityProgress.set(withTiming(next.visibility, { duration }));
      accessoryVisibilityProgress.set(withTiming(next.accessoryVisibility, { duration }));
    };
    syncAnimatedState();
    const unsubscribeBar = useBarStore.subscribe(syncAnimatedState);
    const unsubscribeTabs = useTabBarStore.subscribe(syncAnimatedState);
    return () => { unsubscribeBar(); unsubscribeTabs(); };
  }, [windowWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // DynamicBarTsx1
  const containerStyle = useAnimatedStyle(() => {
    const { attachment, lift } = getGlobalSearchKeyboardShift(searchModeProgress.get(), keyboardProgress.get(), keyboardHeight.get(), insets.bottom);
    const keyboardWidthDelta = getGlobalSearchBarWidth(windowWidth, GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET) - getGlobalSearchBarWidth(windowWidth, GLOBAL_SEARCH_HORIZONTAL_INSET);
    return {
      width: containerWidth.get() + attachment * keyboardWidthDelta,
      height: containerHeight.get(),
      opacity: visibilityProgress.get(),
      transform: [
        { translateX: containerTranslateX.get() },
        { translateY: lift + interpolate(visibilityProgress.get(), [0, 1], [BAR_ENTER_TRANSLATE_Y, 0]) },
      ],
      pointerEvents: visibilityProgress.get() >= 0.99 ? 'auto' : 'none',
    };
  });
  // DynamicBarTsx2
  const accessoryStyle = useAnimatedStyle(() => {
    const { attachment, lift } = getGlobalSearchKeyboardShift(searchModeProgress.get(), keyboardProgress.get(), keyboardHeight.get(), insets.bottom);
    return {
      width: accessorySize.get(),
      height: accessorySize.get(),
      right: accessoryRight.get() + attachment * (GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET - GLOBAL_SEARCH_HORIZONTAL_INSET),
      opacity: accessoryVisibilityProgress.get(),
      transform: [{ translateY: lift + interpolate(accessoryVisibilityProgress.get(), [0, 1], [BAR_ENTER_TRANSLATE_Y, 0]) }],
      pointerEvents: accessoryVisibilityProgress.get() >= 0.99 ? 'auto' : 'none',
    };
  });
  // DynamicBarTsx3 / 4
  const gradientStyle = useAnimatedStyle(() => ({ opacity: visibilityProgress.get() }));

  return (
    <>
      <Animated.View style={[styles.bottomGradient, gradientStyle]} pointerEvents="none">
        <LinearGradient colors={easeGradient(theme.colors.background) as [string, string, ...string[]]} locations={LOCATIONS as [number, number, ...number[]]} style={styles.fill} />
      </Animated.View>
      <View style={[styles.anchor, { bottom: insets.bottom + BAR_BOTTOM_OFFSET }]} pointerEvents="box-none">
        <Animated.View style={[styles.container, containerStyle]} testID="dynamic-bar">
          <View style={styles.content}>
            <DefaultTabsContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <GlobalSearchTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ElementActionTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ClusterTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ClusterSeeSimilarTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <OrganizeClusterTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ScrollToTopTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
          </View>
          <View style={styles.shadow} />
          <View style={styles.innerBorder} />
        </Animated.View>
        <ElementSideActions activeContentIndex={activeContentIndex} contentTransition={contentTransition} windowWidth={windowWidth} />
        <Animated.View style={[styles.accessory, accessoryStyle]}>
          <View style={styles.shadow} />
          <View style={styles.accessoryContent}>
            <DynamicBarSearchAction activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
          </View>
          <View style={styles.innerBorder} />
        </Animated.View>
      </View>
    </>
  );
}

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create((theme) => ({
  fill,
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: BAR_GRADIENT_HEIGHT },
  anchor: { position: 'absolute', left: 0, right: 0, height: TAB_BAR_HOME_HEIGHT, alignItems: 'center' },
  container: { position: 'absolute', bottom: 0, alignSelf: 'center', borderRadius: BAR_PILL_RADIUS },
  accessory: { position: 'absolute', bottom: 0, borderRadius: BAR_PILL_RADIUS },
  accessoryContent: { ...fill, borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.pillElevated, overflow: 'hidden' },
  content: {
    borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.pillElevated, height: '100%', width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  shadow: { ...fill, borderRadius: BAR_PILL_RADIUS, boxShadow: BAR_SHADOW, pointerEvents: 'none' },
  innerBorder: { ...fill, borderRadius: BAR_PILL_RADIUS, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder, pointerEvents: 'none' },
}));
