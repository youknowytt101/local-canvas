// Cosmos' colour picker (components/HueGradient.js, module 3245: SkiaColorPicker, ColorPickerActions, HueGradient,
// ColorPickerKeyboardToolbar; the numbers from lib/settings/hsvToColorString.js and the shader from
// lib/sbPadRuntimeEffect.js; the hex field from ColorPickerHexInput.js):
//   - the saturation / brightness pad: 90 % of the window wide and as tall as the screen leaves (the screen's height less
//     the safe area's top, 2 × spacing.md, the hex pill's 12 below the pad, 30 + the hue bar's 34, spacing.lg and the
//     48 of the buttons, and the bottom inset), drawn by Skia's runtime shader; rounded md, 1 px surfaceBorder, the
//     background behind it. A white 20 ring with a 4 border marks the colour, 13 in from the edges (SELECTOR_INSET).
//     Dragging or touching it (a pan with no minimum distance) moves the ring.
//   - the hex pill hanging 18 over the pad's bottom edge (30 high, rounded 17, background, 1 px surfaceBorder, the strong
//     shadow, 14 / 12 in): # (tertiary) and the six digits (regularPlus) and a 12 swatch of the colour; pressing it
//     types into a hidden field (six characters, capitals, the keyboard's search key searches). While typing, the pill
//     with a caret rides over the keyboard (ColorPickerKeyboardToolbar).
//   - the hue bar 30 below: 34 high, the bar 22 high and rounded 11 at y 6 with the nine stops, a white 20 knob with the
//     strong shadow; dragging along it changes the hue.
//   - the buttons spacing.lg below, the pad's width, spacing.sm apart, regular-weight secondary and primary, large:
//     取消 (清除 when a colour is already searched) and 搜索.
// The colour goes to onHexChange while dragging (once a frame) and when let go. Approximate: the keyboard's pill is
// react-native-keyboard-controller's KeyboardStickyView (Cosmos' KeyboardToolbar module was not read line by line).
import { Canvas, Fill, LinearGradient, RoundedRect, Shader, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';
import { hexToHsv, hsvToColorString, hsvToHex, normalizeHex } from '../../lib/color';
import { Button } from '../Button';

export const DEFAULT_PICKER_HEX = '31F26B';
const PAD_WIDTH_RATIO = 0.9;
const HEX_PILL_OVERHANG = 12; // 30 high, 18 of it over the pad
const HUE_MARGIN_TOP = 30;
const BUTTON_HEIGHT = 48;
const PICKER_RING = 20;
const SELECTOR_INSET = 13;
const HUE_BAR_HEIGHT = 22;
const HUE_BAR_BORDER_RADIUS = 11;
const HUE_WRAP_HEIGHT = 34;
const HUE_GRADIENT_STOPS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'];
const HUE_GRADIENT_Y = 6;
const KNOB_SIZE = 20;
const KNOB_RADIUS = 10;
const HUE_THUMB_CY = 17;

const SB_PAD = Skia.RuntimeEffect.Make(`
uniform vec2 resolution;
uniform float hue;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 main(vec2 pos) {
  vec2 uv = pos / resolution;
  float s = clamp(uv.x, 0.0, 1.0);
  float v = clamp(1.0 - uv.y, 0.0, 1.0);
  vec3 rgb = hsv2rgb(vec3(hue, s, v));
  return vec4(rgb, 1.0);
}
`)!;

const clamp = (x: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, x));
};

type Props = {
  initialHex?: string | null;
  isReentering?: boolean; // a colour is already searched: 清除 in place of 取消
  bottomInset: number;
  onHexChange: (hex: string) => void;
  onClear: () => void;
  onCancel: () => void;
  onSearch: (hex: string) => void;
};

export function SkiaColorPicker({ initialHex, isReentering = false, bottomInset, onHexChange, onClear, onCancel, onSearch }: Props) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const startHex = normalizeHex(initialHex) ?? DEFAULT_PICKER_HEX;
  const start = hexToHsv(startHex) ?? { h: 0, s: 0, v: 0.5 };
  const padW = window.width * PAD_WIDTH_RATIO;
  const padH = Math.max(1, Math.max(window.height, Dimensions.get('screen').height) - (insets.top + 2 * theme.spacing.md + HEX_PILL_OVERHANG + HUE_MARGIN_TOP + HUE_WRAP_HEIGHT + theme.spacing.lg + BUTTON_HEIGHT + bottomInset));

  const hue = useSharedValue(start.h);
  const saturation = useSharedValue(start.s);
  const brightness = useSharedValue(start.v);
  const padWidth = useSharedValue(padW);
  const padHeight = useSharedValue(padH);
  const hueTrackW = useSharedValue(padW);
  useEffect(() => { padWidth.set(padW); padHeight.set(padH); hueTrackW.set(padW); }, [padW, padH, padWidth, padHeight, hueTrackW]);

  const [hex, setHex] = useState(startHex);
  const hexRef = useRef(startHex);
  const onHexChangeRef = useRef(onHexChange);
  onHexChangeRef.current = onHexChange;
  const frame = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const commit = (next: string) => {
    hexRef.current = next;
    setHex(next);
    onHexChangeRef.current(next);
  };
  // pushHexThrottled / pushHexImmediate: once a frame while dragging, at once when let go
  const pushThrottled = (h: number, s: number, v: number) => {
    pending.current = hsvToHex(h, s, v);
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current) commit(pending.current);
      pending.current = null;
    });
  };
  const pushImmediate = (h: number, s: number, v: number) => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
    commit(hsvToHex(h, s, v));
  };
  useEffect(() => () => { if (frame.current != null) cancelAnimationFrame(frame.current); }, []);

  const updateSb = (x: number, y: number) => {
    'worklet';
    const innerW = Math.max(1, padWidth.get() - 2 * SELECTOR_INSET);
    const innerH = Math.max(1, padHeight.get() - 2 * SELECTOR_INSET);
    saturation.set(clamp((x - SELECTOR_INSET) / innerW, 0, 1));
    brightness.set(clamp(1 - (y - SELECTOR_INSET) / innerH, 0, 1));
  };
  const updateHue = (x: number) => {
    'worklet';
    const inner = Math.max(1, hueTrackW.get() - KNOB_SIZE);
    hue.set(clamp((x - KNOB_RADIUS) / inner, 0, 1));
  };
  const padGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { updateSb(e.x, e.y); scheduleOnRN(pushThrottled, hue.get(), saturation.get(), brightness.get()); })
    .onUpdate((e) => { updateSb(e.x, e.y); scheduleOnRN(pushThrottled, hue.get(), saturation.get(), brightness.get()); })
    .onEnd(() => { scheduleOnRN(pushImmediate, hue.get(), saturation.get(), brightness.get()); });
  const hueGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { updateHue(e.x); scheduleOnRN(pushThrottled, hue.get(), saturation.get(), brightness.get()); })
    .onUpdate((e) => { updateHue(e.x); scheduleOnRN(pushThrottled, hue.get(), saturation.get(), brightness.get()); })
    .onEnd(() => { scheduleOnRN(pushImmediate, hue.get(), saturation.get(), brightness.get()); });

  const uniforms = useDerivedValue(() => ({ resolution: vec(padWidth.get(), padHeight.get()), hue: hue.get() }));
  const ringStyle = useAnimatedStyle(() => {
    const innerW = Math.max(1, padWidth.get() - 2 * SELECTOR_INSET);
    const innerH = Math.max(1, padHeight.get() - 2 * SELECTOR_INSET);
    return {
      left: SELECTOR_INSET + saturation.get() * innerW - PICKER_RING / 2,
      top: SELECTOR_INSET + (1 - brightness.get()) * innerH - PICKER_RING / 2,
    };
  });
  const knobStyle = useAnimatedStyle(() => ({ left: KNOB_RADIUS + hue.get() * Math.max(1, hueTrackW.get() - KNOB_SIZE) - KNOB_RADIUS }));

  // the hidden field behind the pill
  const input = useRef<TextInput>(null);
  const [typing, setTyping] = useState(false);
  const onHexInput = (text: string) => {
    const digits = text.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 6);
    hexRef.current = digits;
    setHex(digits);
    const hsv = digits.length === 6 ? hexToHsv(digits) : null;
    if (!hsv) return;
    hue.set(hsv.h);
    saturation.set(hsv.s);
    brightness.set(hsv.v);
    onHexChangeRef.current(digits);
  };
  const search = () => {
    const current = hexRef.current;
    if (current.length === 6 && hexToHsv(current)) onSearch(current);
  };

  const hueStops = useMemo(() => HUE_GRADIENT_STOPS, []);
  return (
    <>
      <View style={styles.root}>
        <View style={styles.panelBlock}>
          <GestureDetector gesture={padGesture}>
            <View style={[styles.panelWrapper, { width: padW, height: padH }]}>
              <Canvas style={StyleSheet.absoluteFill}>
                <Fill>
                  <Shader source={SB_PAD} uniforms={uniforms} />
                </Fill>
              </Canvas>
              <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
            </View>
          </GestureDetector>
          <HexPill hex={hex} hue={hue} saturation={saturation} brightness={brightness} style={styles.floatingHexPill} onPress={() => input.current?.focus()} />
          <TextInput
            ref={input}
            style={styles.hiddenHexInput}
            value={hex}
            onChangeText={onHexInput}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            returnKeyType="search"
            onSubmitEditing={search}
          />
        </View>
        <GestureDetector gesture={hueGesture}>
          <View style={[styles.hueBarWrap, { width: padW }]}>
            <Canvas style={styles.hueCanvas}>
              <RoundedRect x={0} y={HUE_GRADIENT_Y} width={padW} height={HUE_BAR_HEIGHT} r={HUE_BAR_BORDER_RADIUS}>
                <LinearGradient start={vec(0, 0)} end={vec(padW, 0)} colors={hueStops} />
              </RoundedRect>
            </Canvas>
            <Animated.View pointerEvents="none" style={[styles.knob, knobStyle]} />
          </View>
        </GestureDetector>
        <View style={[styles.searchButtonWrap, { width: padW, marginBottom: bottomInset }]}>
          {isReentering
            ? <Button text="清除" variant="secondary" size="large" fullWidth onPress={onClear} style={styles.btn} />
            : <Button text="取消" variant="secondary" size="large" fullWidth onPress={onCancel} style={styles.btn} />}
          <Button text="搜索" size="large" fullWidth onPress={search} style={styles.btn} />
        </View>
      </View>
      {typing ? (
        <KeyboardStickyView style={styles.toolbar}>
          <HexPill hex={hex} hue={hue} saturation={saturation} brightness={brightness} caret onPress={() => input.current?.focus()} />
        </KeyboardStickyView>
      ) : null}
    </>
  );
}

// ColorPickerHexPill
function HexPill({ hex, hue, saturation, brightness, caret = false, style, onPress }: {
  hex: string; hue: SharedValue<number>; saturation: SharedValue<number>; brightness: SharedValue<number>;
  caret?: boolean; style?: object; onPress: () => void;
}) {
  const swatch = useAnimatedStyle(() => ({ backgroundColor: hsvToColorString(hue.get(), saturation.get(), brightness.get()) }));
  return (
    <Pressable style={[styles.hexPill, style]} onPress={onPress} accessibilityRole="button" accessibilityLabel="输入颜色代码">
      <View style={styles.hexValueRow}>
        <Text style={styles.hexText}>
          <Text style={styles.hexTextPrefix}>#</Text>
          {hex}
        </Text>
        {caret ? <View style={styles.hexCaret} /> : null}
      </View>
      <Animated.View style={[styles.hexSwatch, swatch]} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md },
  panelBlock: { alignItems: 'center' },
  panelWrapper: {
    alignSelf: 'center', borderRadius: theme.borderRadius.md, overflow: 'hidden', backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.surfaceBorder,
  },
  ring: { position: 'absolute', width: PICKER_RING, height: PICKER_RING, borderRadius: PICKER_RING / 2, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  hueBarWrap: { marginTop: HUE_MARGIN_TOP, alignSelf: 'center', height: HUE_WRAP_HEIGHT, justifyContent: 'center', position: 'relative' },
  hueCanvas: { width: '100%', height: HUE_WRAP_HEIGHT },
  knob: {
    position: 'absolute', top: HUE_THUMB_CY - KNOB_RADIUS, width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_RADIUS,
    backgroundColor: '#FFFFFF', boxShadow: theme.shadows.strong,
  },
  searchButtonWrap: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.lg, alignSelf: 'center' },
  btn: { flex: 1 },
  hexPill: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.surfaceBorder, boxShadow: theme.shadows.strong, height: 30, paddingLeft: 14, paddingRight: 12,
  },
  floatingHexPill: { marginTop: -18 },
  hexText: { ...theme.typography.regularPlus, color: theme.colors.primary, textAlign: 'left' },
  hexTextPrefix: { color: theme.colors.tertiary },
  hexValueRow: { minWidth: 56, flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2, marginRight: 4 },
  hexSwatch: { width: 12, height: 12, borderRadius: 7 },
  hexCaret: { width: 2, height: 12, borderRadius: 1, backgroundColor: theme.colors.primary },
  hiddenHexInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  toolbar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: theme.spacing.sm },
}));
