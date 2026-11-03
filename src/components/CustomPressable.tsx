// Cosmos' CustomPressable (module 1227, worklets CustomPressableTsx1–3): a Pressable that, going down, calls onPressIn,
// gives a light haptic (haptics, on by default) and scales to targetScale (0.97) in DEFAULT_ANIMATION_DURATION (120 ms,
// withTiming's own curve), and coming up scales back to 1 the same way. Its role is button.
import * as Haptics from 'expo-haptics';
import { triggerImpactFeedback } from '../lib/appearance';
import type { ComponentProps } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const DEFAULT_TARGET_SCALE = 0.97;
const DEFAULT_ANIMATION_DURATION = 120;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle>;
  targetScale?: number;
  haptics?: boolean;
};

export function CustomPressable({ targetScale = DEFAULT_TARGET_SCALE, haptics = true, onPressIn, onPressOut, style, ...rest }: Props) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        onPressIn?.(e);
        if (haptics) triggerImpactFeedback(Haptics.ImpactFeedbackStyle.Light);
        cancelAnimation(scale);
        scale.set(withTiming(targetScale, { duration: DEFAULT_ANIMATION_DURATION }));
      }}
      onPressOut={(e: GestureResponderEvent) => {
        onPressOut?.(e);
        cancelAnimation(scale);
        scale.set(withTiming(1, { duration: DEFAULT_ANIMATION_DURATION }));
      }}
      style={[style, pressed]}
    />
  );
}
