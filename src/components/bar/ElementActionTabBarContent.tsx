// Cosmos' ElementActionTabBarContent (module 2108) and ScrollToTopTabBarContent (module 2195), the element viewer's bar:
//   - actions: the bar is the black 保存 (TAB_BAR_ELEMENT_ACTION_BAR_WIDTH 162 × 62, surfaceInverted, buttonLarge in
//     the inverted colour); 保存 and 已保存 (with a tick TAB_BAR_ELEMENT_SAVE_ICON_GAP 6 before it, the pair
//     TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET 2 left of the middle) cross-fade through the middle (375 ms, shrinking to 0.7).
//     分享 and 更多 are round ActionIconButtons (TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE 60, pillElevated, the bar's
//     shadow and inner border) 8 outside it, sliding in from BAR_ACCESSORY_TRANSLATE_X towards the pill and growing from
//     BAR_ACCESSORY_MIN_SCALE on the content's progress (useContentAnimationTs5)
//   - scroll-to-top: the bar shrinks to a round 62 with ChevronUpIcon (20), back to the top of the viewer
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { CheckIcon, ChevronUpIcon, MoreIcon, ShareIcon } from '../icons';
import {
  BAR_ACCESSORY_MIN_SCALE, BAR_ACCESSORY_TRANSLATE_X, BAR_CONTENT_INDEX, BAR_PILL_RADIUS, BAR_SHADOW,
  TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE, TAB_BAR_ELEMENT_ACTION_BAR_WIDTH, TAB_BAR_ELEMENT_SAVE_CROSSFADE_DURATION, TAB_BAR_ELEMENT_SAVE_ICON_GAP,
  TAB_BAR_ELEMENT_SAVE_SHRINK_SCALE, TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET,
} from './constants';
import { getContentTransitionProgress, useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

const SIDE_GAP = 8;

export function ElementActionTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.elementViewerBarState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.element);
  const saved = useSharedValue(bar?.saved ? 1 : 0);
  useEffect(() => { saved.set(withTiming(bar?.saved ? 1 : 0, { duration: TAB_BAR_ELEMENT_SAVE_CROSSFADE_DURATION })); }, [bar?.saved, saved]);
  const saveLabel = useAnimatedStyle(() => ({
    opacity: interpolate(saved.get(), [0, 0.5], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(saved.get(), [0, 0.5], [1, TAB_BAR_ELEMENT_SAVE_SHRINK_SCALE], 'clamp') }],
  }));
  const savedLabel = useAnimatedStyle(() => ({
    opacity: interpolate(saved.get(), [0.5, 1], [0, 1], 'clamp'),
    transform: [{ translateX: TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET }, { scale: interpolate(saved.get(), [0.5, 1], [TAB_BAR_ELEMENT_SAVE_SHRINK_SCALE, 1], 'clamp') }],
  }));
  return (
    <Animated.View style={[styles.layer, animated]}>
      <Pressable style={styles.save} onPress={bar?.onSave} accessibilityRole="button" accessibilityLabel={bar?.saved ? '已保存' : '保存'}>
        <Animated.View style={[styles.saveLayer, saveLabel]}><Text style={styles.saveText}>保存</Text></Animated.View>
        <Animated.View style={[styles.saveLayer, savedLabel]}>
          <CheckIcon color={theme.colors.inverted} />
          <Text style={styles.saveText}>已保存</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// useContentAnimationTs5: an ActionIconButton slides in from the pill and grows, on the element content's progress
function useSideStyle(sign: 1 | -1, activeContentIndex: SharedValue<number>, contentTransition: SharedValue<ContentTransition>) {
  return useAnimatedStyle(() => {
    const { fromContentIndex, toContentIndex } = contentTransition.get();
    const p = getContentTransitionProgress(activeContentIndex.get(), BAR_CONTENT_INDEX.element, fromContentIndex, toContentIndex);
    return {
      opacity: p,
      transform: [{ translateX: sign * (1 - p) * BAR_ACCESSORY_TRANSLATE_X }, { scale: interpolate(p, [0, 1], [BAR_ACCESSORY_MIN_SCALE, 1]) }],
      pointerEvents: toContentIndex === BAR_CONTENT_INDEX.element ? 'auto' : 'none',
    };
  });
}

// 分享 and 更多, drawn in the bar's full-width row rather than inside the pill (outside its parent a view gets no
// touches on Android), at the same place: 8 outside the 162 pill, which is in the middle of the screen
export function ElementSideActions({ activeContentIndex, contentTransition, windowWidth }: Props & { windowWidth: number }) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.elementViewerBarState);
  const left = useSideStyle(1, activeContentIndex, contentTransition);
  const right = useSideStyle(-1, activeContentIndex, contentTransition);
  const x = windowWidth / 2 - TAB_BAR_ELEMENT_ACTION_BAR_WIDTH / 2 - SIDE_GAP - TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE;
  return (
    <>
      <Animated.View style={[styles.side, { left: x }, left]}>
        <SideButton onPress={bar?.onShare} label="分享"><ShareIcon color={theme.colors.primary} /></SideButton>
      </Animated.View>
      <Animated.View style={[styles.side, { right: x }, right]}>
        <SideButton onPress={bar?.onMore} label="更多"><MoreIcon color={theme.colors.primary} /></SideButton>
      </Animated.View>
    </>
  );
}

function SideButton({ onPress, label, children }: { onPress?: () => void; label: string; children: ReactNode }) {
  return (
    <View style={styles.sideButton}>
      <View style={styles.sideShadow} />
      <Pressable style={styles.sideInner} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{children}</Pressable>
      <View style={styles.sideBorder} />
    </View>
  );
}

export function ScrollToTopTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const onScrollToTop = useBarStore((s) => s.elementViewerBarState?.onScrollToTop);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['scroll-to-top']);
  return (
    <Animated.View style={[styles.layer, animated]}>
      <Pressable style={styles.top} onPress={onScrollToTop} accessibilityRole="button" accessibilityLabel="回到顶部">
        <ChevronUpIcon color={theme.colors.primary} size={20} />
      </Pressable>
    </Animated.View>
  );
}

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create((theme) => ({
  layer: { ...fill, alignItems: 'center', justifyContent: 'center' },
  save: { ...fill, borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.surfaceInverted, alignItems: 'center', justifyContent: 'center' },
  saveLayer: { ...fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: TAB_BAR_ELEMENT_SAVE_ICON_GAP },
  saveText: { ...theme.typography.buttonLarge, color: theme.colors.inverted },
  side: { position: 'absolute', bottom: 1, width: TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE, height: TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE },
  sideButton: { flex: 1 },
  sideShadow: { ...fill, borderRadius: BAR_PILL_RADIUS, boxShadow: BAR_SHADOW },
  sideInner: { ...fill, borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.pillElevated, alignItems: 'center', justifyContent: 'center' },
  sideBorder: { ...fill, borderRadius: BAR_PILL_RADIUS, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder, pointerEvents: 'none' },
  top: { ...fill, alignItems: 'center', justifyContent: 'center' },
}));
