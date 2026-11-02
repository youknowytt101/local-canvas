// Cosmos' DynamicBar (module 2056): one floating pill over every screen, drawn outside the navigators (RootNavigator puts
// it after the stack) and fed by useTabBarStore / useBarStore. It changes shape for what it holds (getBarTargets: the
// tabs, the search field, later the element's and the collection's actions), springs between sizes
// (TAB_BAR_SIZE_SPRING_CONFIG; GLOBAL_SEARCH_MORPH_(EXIT_)SPRING_CONFIG into / out of search) and cross-fades its
// contents (BAR_CONTENT_SHOW_DURATION). Beside it is a round accessory (search / close). While searching, both ride on
// the keyboard (getGlobalSearchKeyboardShift) and widen to GLOBAL_SEARCH_KEYBOARD_HORIZONTAL_INSET.
// Layers, as Cosmos' styles: the eased bottom gradient (BAR_GRADIENT_HEIGHT, background 00 → 66), then for the pill and
// the accessory a shadow (BAR_SHADOW), the pillElevated content and a .5 surfaceBorder inner border.
// Phones only: the tablet sizes (TAB_BAR_DEFAULT_WIDTH from TAB_BAR_TABLET_BREAKPOINT) are not used (no iPad build).
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { useWindowDimensions, View } from 'react-native';
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
  GLOBAL_SEARCH_MORPH_EXIT_SPRING_CONFIG, GLOBAL_SEARCH_MORPH_SPRING_CONFIG, TAB_BAR_ACTION_GAP, TAB_BAR_HOME_HEIGHT,
  TAB_BAR_ELEMENT_ACTION_BAR_WIDTH, TAB_BAR_ELEMENT_SCROLL_TO_TOP_SIZE, TAB_BAR_HEIGHT_DEFAULT, TAB_BAR_SEARCH_ACTION_SIZE, TAB_BAR_SIZE_SPRING_CONFIG, getEdgeToEdgeBarWidth, getGlobalSearchBarWidth,
  getGlobalSearchKeyboardShift, TAB_BAR_CLUSTER_HEIGHT, TAB_BAR_CLUSTER_ORGANIZE_WIDTH, TAB_BAR_CLUSTER_SEE_SIMILAR_HEIGHT, TAB_BAR_CLUSTER_SEE_SIMILAR_WIDTH,
  TAB_BAR_CLUSTER_USER_WIDTH, type BarContent,
} from './constants';
import { ClusterSeeSimilarTabBarContent, ClusterTabBarContent, OrganizeClusterTabBarContent } from './ClusterTabBarContent';
import { DefaultTabsContent } from './DefaultTabsContent';
import { DynamicBarSearchAction } from './DynamicBarSearchAction';
import { ElementActionTabBarContent, ElementSideActions, ScrollToTopTabBarContent } from './ElementActionTabBarContent';
import { GlobalSearchTabBarContent } from './GlobalSearchTabBarContent';
import type { ContentTransition } from './useContentAnimation';

type Targets = { contentIndex: number; width: number; height: number; translateX: number; accessorySize: number; visibility: number; accessoryVisibility: number };

// getBarTargets, for the contents built so far. The default pill leaves room for the accessory and is moved left by
// half of it (getDefaultBarOffsetX); search the same with the search sizes.
function getBarTargets(type: BarContent, isHidden: boolean, windowWidth: number): Targets {
  // the element viewer: the 162 wide 保存, or the round scroll-to-top; the accessory goes
  // a collection: its four actions, or 看相似 on someone else's; the accessory goes
  // organizing a collection: 移动 / 移除 / 完成 in TAB_BAR_CLUSTER_ORGANIZE_WIDTH (210), the default height
  if (type === 'organize') {
    return {
      contentIndex: BAR_CONTENT_INDEX[type], width: TAB_BAR_CLUSTER_ORGANIZE_WIDTH, height: TAB_BAR_HEIGHT_DEFAULT, translateX: 0,
      accessorySize: TAB_BAR_SEARCH_ACTION_SIZE, visibility: isHidden ? 0 : 1, accessoryVisibility: 0,
    };
  }
  if (type === 'cluster' || type === 'cluster-see-similar') {
    const mine = type === 'cluster';
    return {
      contentIndex: BAR_CONTENT_INDEX[type], width: mine ? TAB_BAR_CLUSTER_USER_WIDTH : TAB_BAR_CLUSTER_SEE_SIMILAR_WIDTH,
      height: mine ? TAB_BAR_CLUSTER_HEIGHT : TAB_BAR_CLUSTER_SEE_SIMILAR_HEIGHT, translateX: 0, accessorySize: TAB_BAR_SEARCH_ACTION_SIZE,
      visibility: isHidden ? 0 : 1, accessoryVisibility: 0,
    };
  }
  if (type === 'element' || type === 'scroll-to-top') {
    const width = type === 'element' ? TAB_BAR_ELEMENT_ACTION_BAR_WIDTH : TAB_BAR_ELEMENT_SCROLL_TO_TOP_SIZE;
    return {
      contentIndex: BAR_CONTENT_INDEX[type], width, height: TAB_BAR_HEIGHT_DEFAULT, translateX: 0, accessorySize: TAB_BAR_SEARCH_ACTION_SIZE,
      visibility: isHidden ? 0 : 1, accessoryVisibility: 0,
    };
  }
  const search = type === 'global-search';
  const actionSize = search ? GLOBAL_SEARCH_ACTION_SIZE : TAB_BAR_SEARCH_ACTION_SIZE;
  const actionGap = search ? GLOBAL_SEARCH_ACTION_GAP : TAB_BAR_ACTION_GAP;
  return {
    contentIndex: BAR_CONTENT_INDEX[type],
    width: getEdgeToEdgeBarWidth(windowWidth, GLOBAL_SEARCH_HORIZONTAL_INSET, actionGap, actionSize),
    height: search ? GLOBAL_SEARCH_BAR_HEIGHT : TAB_BAR_HOME_HEIGHT,
    translateX: -(actionGap + actionSize) / 2,
    accessorySize: actionSize,
    visibility: isHidden ? 0 : 1,
    accessoryVisibility: isHidden ? 0 : 1,
  };
}

// easeGradient (module 2059): 12 eased steps (ease-in-out) between the two colours; here the alpha of each stop
const EASED = [0, 0.0125, 0.055, 0.13, 0.2325, 0.36, 0.5, 0.64, 0.7675, 0.87, 0.945, 0.9875, 1];
const LOCATIONS = EASED.map((_, i) => i / (EASED.length - 1));
const easeGradient = (background: string) =>
  EASED.map((f) => `${background}${Math.round(0x66 * f).toString(16).padStart(2, '0')}`);

export function DynamicBar() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // the viewer's bar is 'element' with its mode: actions, or scrolled down to the similar ones
  const type = useBarStore((s) => (s.activeState.type === 'element' && s.elementViewerBarState?.mode === 'scrollToTop' ? 'scroll-to-top' : s.activeState.type));
  const tabBarSuppressed = useBarStore((s) => s.tabBarSuppressed);
  const activeScreen = useBarStore((s) => s.activeScreen);
  const hasTabs = useTabBarStore((s) => s.tabNavProps != null);
  const isHidden = !hasTabs || tabBarSuppressed || (activeScreen != null && BAR_HIDDEN_SCREENS.has(activeScreen));
  const targets = getBarTargets(type, isHidden, windowWidth);

  const containerWidth = useSharedValue(targets.width);
  const containerHeight = useSharedValue(targets.height);
  const containerTranslateX = useSharedValue(targets.translateX);
  const accessorySize = useSharedValue(targets.accessorySize);
  const accessoryRight = useSharedValue(GLOBAL_SEARCH_HORIZONTAL_INSET);
  const visibilityProgress = useSharedValue(targets.visibility);
  const accessoryVisibilityProgress = useSharedValue(targets.accessoryVisibility);
  const searchModeProgress = useSharedValue(type === 'global-search' ? 1 : 0);
  const activeContentIndex = useSharedValue(targets.contentIndex);
  const contentTransition = useSharedValue<ContentTransition>({ fromContentIndex: targets.contentIndex, toContentIndex: targets.contentIndex });
  const { height: keyboardHeight, progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const shown = useRef(type);

  useEffect(() => {
    if (hasTabs) preloadGlobalSearch();
  }, [hasTabs]);

  useEffect(() => {
    const t = getBarTargets(type, isHidden, windowWidth);
    const { toContentIndex } = contentTransition.get();
    if (t.contentIndex !== toContentIndex) {
      contentTransition.set({ fromContentIndex: toContentIndex, toContentIndex: t.contentIndex });
      activeContentIndex.set(withTiming(t.contentIndex, { duration: BAR_CONTENT_SHOW_DURATION }));
    }
    const spring = type === 'global-search' ? GLOBAL_SEARCH_MORPH_SPRING_CONFIG
      : shown.current === 'global-search' ? GLOBAL_SEARCH_MORPH_EXIT_SPRING_CONFIG : TAB_BAR_SIZE_SPRING_CONFIG;
    containerWidth.set(withSpring(t.width, spring));
    containerHeight.set(withSpring(t.height, spring));
    containerTranslateX.set(withSpring(t.translateX, spring));
    accessorySize.set(withSpring(t.accessorySize, spring));
    searchModeProgress.set(withSpring(type === 'global-search' ? 1 : 0, spring));
    const duration = isHidden ? BAR_HIDE_DURATION : BAR_SHOW_DURATION;
    visibilityProgress.set(withTiming(t.visibility, { duration }));
    accessoryVisibilityProgress.set(withTiming(t.accessoryVisibility, { duration }));
    shown.current = type;
  }, [type, isHidden, windowWidth]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Animated.View style={[styles.container, containerStyle]}>
          <View style={styles.shadow} />
          <View style={styles.content}>
            <DefaultTabsContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <GlobalSearchTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ElementActionTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ScrollToTopTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ClusterTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <ClusterSeeSimilarTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
            <OrganizeClusterTabBarContent activeContentIndex={activeContentIndex} contentTransition={contentTransition} />
          </View>
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
