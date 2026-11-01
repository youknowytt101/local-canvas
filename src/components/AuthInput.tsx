// Cosmos' AuthInput (components/auth/AuthInput): 56 high (size.xl), 20 to each side, radius md, a 0.5 border in
// surfaceBorder on pillElevated; focused, a layer with the default shadow comes up behind it (Cosmos draws it as a
// drop-shadow filter: here a box shadow, iOS has no filter). Text bodyBook.md, its size as line height, letter spacing -2 %.
import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export function AuthInput(props: TextInputProps) {
  const { theme } = useUnistyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.shadowWrapper}>
      {focused ? <View style={styles.focusedContainer} /> : null}
      <View style={styles.container}>
        <TextInput
          placeholderTextColor={theme.colors.tertiary}
          selectionColor={theme.colors.primary}
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, props.style]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  shadowWrapper: { alignSelf: 'stretch', position: 'relative', borderRadius: theme.borderRadius.md },
  container: {
    alignSelf: 'stretch',
    minHeight: theme.size.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.pillElevated,
    justifyContent: 'center',
  },
  focusedContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.pillElevated,
    boxShadow: theme.shadows.default,
  },
  input: {
    ...theme.typography.bodyBook.md,
    lineHeight: theme.typography.bodyBook.md.fontSize,
    letterSpacing: -((theme.typography.bodyBook.md.fontSize ?? 16) * 0.02),
    color: theme.colors.primary,
    includeFontPadding: false,
    paddingVertical: 0,
    minHeight: theme.size.xl,
  },
}));
