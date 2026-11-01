// Cosmos' AppToast (module 3040 area, styles read from the bytecode): at the top, insets.top + spacing.md down, centred,
// over everything. A plain toast is at most 230 wide on the background colour with a 0.5 surfaceBorder outline,
// spacing.xs high padding; one with an action (查看) is at most 340 wide on surfaceInverted, 10 high padding, its
// action a 28 high pill on the inverted colour (regularPlus, primary); a picture of what it is about sits first
// (24, round). The text is regularPlus. It comes in over 170 ms (bezier 0.22, 1, 0.36, 1) from 12 above and 0.985,
// and goes in 140 ms (bezier 0.4, 0, 1, 1) — AppToastTsx1.
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { useToastStore, type Toast } from '../stores/useToastStore';

const IN = { duration: 170, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const OUT = { duration: 140, easing: Easing.bezier(0.4, 0, 1, 1) };

export function AppToast() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((s) => s.toast);
  const [shown, setShown] = useState<Toast | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (toast) {
      setShown(toast);
      progress.set(withTiming(1, IN));
      const t = setTimeout(() => useToastStore.getState().hide(toast.id), toast.duration);
      return () => clearTimeout(t);
    }
    progress.set(withTiming(0, OUT, (done) => { if (done) runOnJS(setShown)(null); }));
  }, [toast, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [-12, 0]) }, { scale: interpolate(progress.get(), [0, 1], [0.985, 1]) }],
  }));

  if (!shown) return null;
  const action = !!shown.actionText;
  return (
    <View style={[styles.overlay, { paddingTop: insets.top + 16 }]} pointerEvents="box-none">
      <Animated.View style={[styles.toast(action), animated]}>
        {shown.imageUrl ? <Image source={{ uri: shown.imageUrl }} blurRadius={shown.imageBlurred ? 8 : 0} style={styles.thumbnail} /> : null}
        <Text style={styles.text(action)} numberOfLines={2}>{shown.text}</Text>
        {action ? (
          <Pressable style={styles.actionButton} onPress={() => { shown.onAction?.(); useToastStore.getState().hide(shown.id); }} accessibilityRole="button">
            <Text style={styles.actionText}>{shown.actionText}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 99999 },
  toast: (action: boolean) => ({
    maxWidth: action ? 340 : 230, borderRadius: theme.borderRadius.full,
    backgroundColor: action ? theme.colors.surfaceInverted : theme.colors.background,
    borderWidth: action ? 1 : 0.5, borderColor: theme.colors.surfaceBorder,
    paddingVertical: action ? 10 : theme.spacing.xs, paddingLeft: action ? theme.spacing.sm : theme.spacing.md,
    paddingRight: action ? theme.spacing.sm : theme.spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, boxShadow: theme.shadows.default,
  }),
  thumbnail: { width: 24, height: 24, borderRadius: theme.borderRadius.full, flexShrink: 0 },
  text: (action: boolean) => ({ ...theme.typography.regularPlus, color: action ? theme.colors.inverted : theme.colors.primary, flexShrink: 1 }),
  actionButton: {
    height: 28, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.inverted, paddingHorizontal: theme.spacing.xs,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionText: { ...theme.typography.regularPlus, color: theme.colors.primary },
}));
