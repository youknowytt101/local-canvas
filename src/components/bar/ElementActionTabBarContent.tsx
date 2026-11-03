// Cosmos' ElementActionTabBarContent (module 2108) and ScrollToTopTabBarContent (module 2195):
//   - the element viewer's bar (BAR_CONTENT_INDEX.element), in its two modes (elementViewerBarState.mode):
//     - actions: the black 保存 (centerAction TAB_BAR_ELEMENT_ACTION_BAR_WIDTH 162 × 62, surfaceInverted, largePlus in the
//       inverted colour, a CustomPressable with haptics); 保存 and 已保存 (with a tick TAB_BAR_ELEMENT_SAVE_ICON_GAP 6
//       before it, the pair TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET 2 left of the middle) cross-fade through the middle
//       (getSaveCrossfadeStyle: 375 ms inOut(ease), shrinking to 0.7) when the same element's state changes
//       (shouldAnimateSaveCrossfade), and are set at once for another element. 分享 and 更多 are ActionIconButtons
//       (TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE 60, pillElevated, the bar's shadow and inner border, icon 24 primary,
//       a CustomPressable) spacing.xs outside it, sliding in from BAR_ACCESSORY_TRANSLATE_X towards the pill and growing
//       from BAR_ACCESSORY_MIN_SCALE on the content's progress (useContentAnimationTs5)
//     - scrollToTop: the same content draws instead a pillElevated round button with ChevronUpIcon (20, primary), back
//       to the top of the viewer; the change is not a cross-fade (the bar's content stays the element's): the side
//       buttons go at once while the pill springs from 162 to 62
//   - a screen's scroll-to-top (BAR_CONTENT_INDEX['scroll-to-top'], a collection's similar page): a black
//     (surfaceInverted) round 62 with ChevronUpIcon (20, inverted), its state's onPress
import { useEffect, useRef, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useBarStore } from '../../stores/useBarStore';
import { CustomPressable } from '../CustomPressable';
import { CheckIcon, ChevronUpIcon, MoreIcon, ShareIcon } from '../icons';
import {
  BAR_CONTENT_INDEX, BAR_PILL_RADIUS, BAR_SHADOW,
  TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE, TAB_BAR_ELEMENT_ACTION_BAR_WIDTH, TAB_BAR_ELEMENT_SAVE_CROSSFADE_DURATION, TAB_BAR_ELEMENT_SAVE_ICON_GAP,
  TAB_BAR_ELEMENT_SAVE_SHRINK_SCALE, TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET, TAB_BAR_HEIGHT_DEFAULT,
} from './constants';
import { useActionButtonAnimation, useContentAnimation, type ContentTransition } from './useContentAnimation';

type Props = { activeContentIndex: SharedValue<number>; contentTransition: SharedValue<ContentTransition> };

// saveCrossfadeTs2: 保存 fades and shrinks over the first half, 已保存 grows and fades in over the second
function getSaveCrossfadeStyle(progress: number, layer: 'save' | 'saved') {
  'worklet';
  const clamped = Math.min(Math.max(progress, 0), 1);
  const shrink = TAB_BAR_ELEMENT_SAVE_SHRINK_SCALE;
  if (layer === 'save') {
    const half = Math.min(clamped, 0.5) * 2;
    return { opacity: 1 - half, scale: 1 + (shrink - 1) * half };
  }
  const half = Math.max(clamped - 0.5, 0) * 2;
  return { opacity: half, scale: shrink + (1 - shrink) * half };
}

export function ElementActionTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.elementViewerBarState);
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.element);
  const savedProgress = useSharedValue(bar?.saved ? 1 : 0);
  // shouldAnimateSaveCrossfade: only a change of the same element's state is animated
  const shownElement = useRef(bar?.elementId);
  useEffect(() => {
    const target = bar?.saved ? 1 : 0;
    const sameElement = bar?.elementId != null && bar.elementId === shownElement.current;
    shownElement.current = bar?.elementId;
    savedProgress.set(sameElement
      ? withTiming(target, { duration: TAB_BAR_ELEMENT_SAVE_CROSSFADE_DURATION, easing: Easing.inOut(Easing.ease) })
      : target);
  }, [bar?.saved, bar?.elementId, savedProgress]);
  const saveLabel = useAnimatedStyle(() => {
    const { opacity, scale } = getSaveCrossfadeStyle(savedProgress.get(), 'save');
    return { opacity, transform: [{ scale }] };
  });
  const savedLabel = useAnimatedStyle(() => {
    const { opacity, scale } = getSaveCrossfadeStyle(savedProgress.get(), 'saved');
    return { opacity, transform: [{ scale }] };
  });

  if (bar?.mode === 'scrollToTop') {
    return (
      <Animated.View style={[styles.container, animated]}>
        <CustomPressable onPress={bar.scrollToTopHandler} style={[styles.background, styles.scrollToTopButton]}>
          <ChevronUpIcon color={theme.colors.primary} size={20} />
        </CustomPressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[styles.container, animated]}>
      <CustomPressable onPress={bar?.onSave} style={styles.centerAction} accessibilityLabel={bar?.saved ? '已保存' : '保存'}>
        <Animated.View style={[styles.crossfadeLayer, saveLabel]}><Text style={styles.label}>保存</Text></Animated.View>
        <Animated.View style={[styles.crossfadeLayer, styles.savedLayer, savedLabel]}>
          <CheckIcon color={theme.colors.inverted} size={24} />
          <Text style={styles.label}>已保存</Text>
        </Animated.View>
      </CustomPressable>
    </Animated.View>
  );
}

// The ActionIconButtons 分享 (left) and 更多 (right), drawn in the bar's full-width row rather than inside the pill
// (outside its parent a view gets no touches on Android), at the same place: spacing.xs outside the 162 pill, which is
// in the middle of the screen. Only in the actions mode, as Cosmos draws them.
export function ElementSideActions({ activeContentIndex, contentTransition, windowWidth }: Props & { windowWidth: number }) {
  const { theme } = useUnistyles();
  const bar = useBarStore((s) => s.elementViewerBarState);
  const left = useActionButtonAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.element, 'left');
  const right = useActionButtonAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX.element, 'right');
  if (bar?.mode === 'scrollToTop') return null;
  const x = windowWidth / 2 - TAB_BAR_ELEMENT_ACTION_BAR_WIDTH / 2 - theme.spacing.xs - TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE;
  return (
    <>
      <Animated.View style={[styles.side, { left: x }, left]}>
        <ActionIconButton onPress={bar?.onShare}><ShareIcon color={theme.colors.primary} size={24} /></ActionIconButton>
      </Animated.View>
      <Animated.View style={[styles.side, { right: x }, right]}>
        <ActionIconButton onPress={bar?.onMore}><MoreIcon color={theme.colors.primary} size={24} /></ActionIconButton>
      </Animated.View>
    </>
  );
}

function ActionIconButton({ onPress, children }: { onPress?: () => void; children: ReactNode }) {
  return (
    <View style={styles.sideButton}>
      <View style={styles.sideShadow} />
      <CustomPressable style={styles.sideContent} onPress={onPress}>{children}</CustomPressable>
      <View style={styles.sideBorder} />
    </View>
  );
}

export function ScrollToTopTabBarContent({ activeContentIndex, contentTransition }: Props) {
  const { theme } = useUnistyles();
  // getScrollToTopState
  const onPress = useBarStore((s) => (s.activeState.type === 'scroll-to-top' ? s.activeState.onPress : undefined));
  const animated = useContentAnimation(activeContentIndex, contentTransition, BAR_CONTENT_INDEX['scroll-to-top']);
  return (
    <Animated.View style={[styles.layer, animated]}>
      <CustomPressable onPress={onPress} style={styles.invertedButton}>
        <ChevronUpIcon color={theme.colors.inverted} size={20} />
      </CustomPressable>
    </Animated.View>
  );
}

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create((theme) => ({
  container: { ...fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  background: { ...fill, borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.surfaceInverted },
  centerAction: {
    alignItems: 'center', justifyContent: 'center', width: TAB_BAR_ELEMENT_ACTION_BAR_WIDTH, height: TAB_BAR_HEIGHT_DEFAULT,
    borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.surfaceInverted,
  },
  crossfadeLayer: { ...fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: TAB_BAR_ELEMENT_SAVE_ICON_GAP },
  savedLayer: { left: TAB_BAR_ELEMENT_SAVED_CENTER_OFFSET },
  label: { ...theme.typography.largePlus, color: theme.colors.inverted },
  scrollToTopButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.pillElevated },
  layer: { ...fill, alignItems: 'center', justifyContent: 'center' },
  invertedButton: { ...fill, alignItems: 'center', justifyContent: 'center', borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.surfaceInverted },
  side: { position: 'absolute', bottom: 1, width: TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE, height: TAB_BAR_ELEMENT_ACTION_BAR_BUTTON_SIZE },
  sideButton: { flex: 1 },
  sideShadow: { ...fill, borderRadius: BAR_PILL_RADIUS, boxShadow: BAR_SHADOW },
  sideContent: { ...fill, borderRadius: BAR_PILL_RADIUS, backgroundColor: theme.colors.pillElevated, alignItems: 'center', justifyContent: 'center' },
  sideBorder: { ...fill, borderRadius: BAR_PILL_RADIUS, borderWidth: 0.5, borderColor: theme.colors.surfaceBorder, pointerEvents: 'none' },
}));
