// Cosmos' Button (module 1314): fully round; variants primary / invertedPrimary / secondary / glass / sheetFilled /
// transparent / outline / destructive; sizes extraSmall 28 · small 34 · regular 40 · large 48 · extraLarge 56 high with
// xs / sm / md / lg / xl side padding; text buttonMedium; disabled = the background at 20 % (…33) and inverted text.
// Pressing scales to 0.975 in 70 ms and springs back (220 ms, damping ratio 0.8), the press cosmos-lite measured (MOTION.press).
// `glass` draws Cosmos' drop-shadow filter as a box shadow (iOS has no filter: local, close).
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'invertedPrimary' | 'secondary' | 'glass' | 'sheetFilled' | 'transparent' | 'outline' | 'destructive';
export type ButtonSize = 'extraSmall' | 'small' | 'regular' | 'large' | 'extraLarge';

type Props = {
  text: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  fitContent?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ text, onPress, variant = 'primary', size = 'regular', fullWidth = false, fitContent = false, disabled = false, loading = false, style }: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ variant, size, fullWidth, fitContent, disabled });
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;
  // the text's colour is worked out here, not as a style variant: Unistyles did not repaint it when the variant
  // changed on a mounted button (正在关注 → 关注 kept the dark text on the dark button)
  const textColor = disabled ? (variant === 'sheetFilled' ? theme.colors.tertiary : theme.colors.inverted) : variant === 'primary' ? theme.colors.inverted : variant === 'invertedPrimary' ? theme.colors.surfaceInverted : variant === 'destructive' ? theme.colors.alert : theme.colors.primary;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.975, { duration: 70 }); }}
      onPressOut={() => { scale.value = withSpring(1, { duration: 220, dampingRatio: 0.8 }); }}
      style={[styles.button, disabled && styles.disabledBackground(variant), pressed, style]}
    >
      <View style={styles.textContainer}>
        {loading ? <ActivityIndicator size="small" color={textColor} /> : <Text style={{ ...theme.typography.buttonMedium, color: textColor }} numberOfLines={1}>{text}</Text>}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.full,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.primary },
        invertedPrimary: { backgroundColor: theme.colors.inverted },
        secondary: { backgroundColor: theme.colors.elevated },
        glass: { backgroundColor: theme.colors.background, boxShadow: theme.shadows.default, overflow: 'visible' },
        sheetFilled: { backgroundColor: theme.colors.sheetBackground },
        transparent: { backgroundColor: 'transparent' },
        outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.surfaceBorder },
        destructive: { backgroundColor: theme.colors.elevated },
      },
      fullWidth: { true: { width: '100%' }, false: { width: 'auto' } },
      size: {
        extraSmall: { height: 28, paddingHorizontal: theme.spacing.xs },
        small: { height: 34, paddingHorizontal: theme.spacing.sm },
        regular: { height: 40, paddingHorizontal: theme.spacing.md },
        large: { height: 48, paddingHorizontal: theme.spacing.lg },
        extraLarge: { height: 56, paddingHorizontal: theme.spacing.xl },
      },
      fitContent: { true: { alignSelf: 'center' }, false: {} },
      disabled: { true: {}, false: {} },
    },
  },
  disabledBackground: (variant: ButtonVariant) => ({
    backgroundColor: {
      primary: `${theme.colors.primary}33`,
      invertedPrimary: `${theme.colors.inverted}33`,
      secondary: `${theme.colors.elevated}33`,
      glass: `${theme.colors.background}33`,
      sheetFilled: theme.colors.sheetBackground,
      transparent: 'transparent',
      outline: `${theme.colors.surfaceBorder}33`,
      destructive: `${theme.colors.alert}33`,
    }[variant],
  }),
  textContainer: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs },
}));
