// Cosmos' CanvasSeedHistoryBar (components/elements/CanvasSeedHistoryBar.js): the recent seeds as a little stack at the
// bottom of the canvas, the newest on the right. Numbers from the module (CARD_SIZE 40, OVERLAP −6 so a step of 34,
// stack padding 15, background radius 20, at most 5, PRESSED_TRANSLATE_Y −75, PRESSED_SCALE 1.9, the pressed card
// zIndex 100):
//   - overlay: absolute, the whole width, insetsBottom + 4 from the bottom, centred; the stack a row with its padding over
//     a background (absoluteFill, radius 20, 0.5 surfaceBorder, background at 80 %)
//   - a card: 40 × 40, the ones after the first −6 to the left, turned by its id (a 31-hash: |h| mod 1001 / 100 − 5 deg),
//     zIndex its place + 1; inside, radius xs, a 2 px elevated border, emptyCardBackground, its picture
//   - a card comes in fading over 300 ms from 20 to the right and half its size (springs damping 18, mass 1, stiffness
//     260, velocity 0.5) (CanvasSeedHistoryBarTsx1)
//   - pressing the stack picks the card under the finger and slides with it (getItemAtPageX, updatePressedItem): the
//     picked card rises 75 and grows 1.9 times (CanvasSeedHistoryBarTsx2); letting go there brings that seed back
//     (handleResponderRelease)
// Near Cosmos: the pressed card's progress is a spring of the same numbers as the coming in (its own config not read).
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import type { Element } from '../../lib/elements';
import { absoluteUrl } from '../../lib/server';

export type SeedHistoryItem = { elementId: string; element: Element; sourceIndex: number };

const CARD_SIZE = 40;
const OVERLAP = -6;
const STEP = 34;
const STACK_PADDING = 15;
const BACKGROUND_RADIUS = 20;
const LIMIT = 5;
const PRESSED_TRANSLATE_Y = -75;
const PRESSED_SCALE = 1.9;
const PRESSED_Z = 100;
const ENTERING_TRANSLATE_X = 20;
const ENTERING_SCALE = 0.5;
const SPRING = { damping: 18, mass: 1, stiffness: 260, velocity: 0.5 };

// getRotation
function rotationOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1001) / 100 - 5).toFixed(2);
}

const pictureOf = (el: Element) => (el.mediaKind === 'video' ? el.posterSmallUrl || el.posterThumbUrl || el.posterUrl : el.smallUrl || el.thumbUrl || el.mediaUrl) ?? null;

function SeedCard({ item, index, pressed }: { item: SeedHistoryItem; index: number; pressed: boolean }) {
  const enter = useSharedValue(0);
  const press = useSharedValue(0);
  useEffect(() => { enter.set(1); }, [enter]);
  useEffect(() => { press.set(withSpring(pressed ? 1 : 0, SPRING)); }, [pressed, press]);
  const motion = useAnimatedStyle(() => ({
    opacity: withTiming(enter.get(), { duration: 300 }),
    transform: [
      { translateX: withSpring((1 - enter.get()) * ENTERING_TRANSLATE_X, SPRING) },
      { translateY: press.get() * PRESSED_TRANSLATE_Y },
      { scale: withSpring(enter.get() ? 1 : ENTERING_SCALE, SPRING) },
      { scale: 1 + press.get() * (PRESSED_SCALE - 1) },
    ],
  }));
  const uri = pictureOf(item.element);
  return (
    <View style={styles.cardFrame(index, rotationOf(item.elementId), pressed)}>
      <Animated.View style={[styles.cardMotion, motion]}>
        <View style={styles.card}>
          {uri ? <Image source={{ uri: absoluteUrl(uri) }} style={styles.image} contentFit="cover" /> : null}
        </View>
      </Animated.View>
    </View>
  );
}

export function CanvasSeedHistoryBar({ items, onItemPress }: { items: SeedHistoryItem[]; onItemPress: (item: SeedHistoryItem) => void }) {
  useSafeAreaInsets(); // the overlay's bottom follows the insets (styles)
  const shown = items.slice(0, LIMIT).reverse();
  const [pressedId, setPressedId] = useState<string | null>(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // getItemAtPageX: the card under x along the stack (x from the stack's own left)
  const itemAt = (x: number) => {
    const list = shownRef.current;
    const local = x - STACK_PADDING;
    if (local < -STACK_PADDING || local > (list.length - 1) * STEP + CARD_SIZE + STACK_PADDING) return null;
    return list[Math.min(list.length - 1, Math.max(0, Math.floor(local / STEP)))] ?? null;
  };
  const update = (x: number) => setPressedId(itemAt(x)?.elementId ?? null);
  const release = (x: number) => {
    const it = itemAt(x);
    setPressedId(null);
    if (it) onItemPress(it);
  };
  const cancel = () => setPressedId(null);
  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { scheduleOnRN(update, e.x); })
    .onUpdate((e) => { scheduleOnRN(update, e.x); })
    .onEnd((e) => { scheduleOnRN(release, e.x); })
    .onFinalize((_e, success) => { if (!success) scheduleOnRN(cancel); });
  if (!shown.length) return null;
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <GestureDetector gesture={gesture}>
        <View style={styles.stack}>
          <View style={styles.background} />
          {shown.map((item, i) => <SeedCard key={item.elementId} item={item} index={i} pressed={pressedId === item.elementId} />)}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: rt.insets.bottom + 4, alignItems: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center', padding: STACK_PADDING },
  background: {
    ...StyleSheet.absoluteFillObject, borderRadius: BACKGROUND_RADIUS, overflow: 'hidden', borderWidth: 0.5,
    borderColor: theme.colors.surfaceBorder, backgroundColor: `${theme.colors.background}CC`,
  },
  cardFrame: (index: number, rotation: string, pressed: boolean) => ({
    width: CARD_SIZE, height: CARD_SIZE, marginLeft: index !== 0 ? OVERLAP : 0, transform: [{ rotate: `${rotation}deg` }], zIndex: pressed ? PRESSED_Z : index + 1,
  }),
  cardMotion: { width: '100%', height: '100%' },
  card: {
    width: '100%', height: '100%', borderRadius: theme.borderRadius.xs, overflow: 'hidden', borderWidth: 2,
    borderColor: theme.colors.elevated, backgroundColor: theme.colors.emptyCardBackground,
  },
  image: { width: '100%', height: '100%' },
}));
