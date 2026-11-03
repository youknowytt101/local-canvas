// Cosmos' IntroFooter: at the bottom, over everything: on the first page 创建帐户即表示您同意我们的 / 服务条款 和 隐私政策 (body.xxs,
// secondary; the links open Cosmos' own pages); a regular button (开始, on the last page 开始使用; 40 in, white on the last
// page) and under it one bar a page (3 high, xxs apart, 11 × pages − 1 + 24 wide together), the current one three parts wide
// and whole, the others faint, changing over 500 ms.
import { Linking, type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const INDICATOR_WIDTH_PER_STEP = 11;
const INDICATOR_EXTRA_WIDTH = 24;
const TERMS_OF_SERVICE_URL = 'https://www.cosmos.so/legal/terms-conditions';
const PRIVACY_POLICY_URL = 'https://www.cosmos.so/legal/privacy-policy';

export function IntroFooter({ onStart, activeStep, numberOfSteps, useSlideWhiteTheme, onControlsLayout, lastStepIndex }: {
  onStart: () => void; activeStep: number; numberOfSteps: number; useSlideWhiteTheme: boolean;
  onControlsLayout: (e: LayoutChangeEvent) => void; lastStepIndex: number;
}) {
  const { theme } = useUnistyles();
  const label = activeStep === lastStepIndex ? '开始使用' : '开始';
  const buttonColor = useSlideWhiteTheme ? '#FFFFFF' : theme.colors.primary;
  const textColor = useSlideWhiteTheme ? '#0D0D0D' : theme.colors.inverted;
  return (
    <View style={styles.container} pointerEvents="box-none">
      {activeStep === 0 ? (
        <Text style={styles.terms}>
          创建帐户即表示您同意我们的{'\n'}
          <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)}>服务条款</Text>
          {' '}和{' '}
          <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>隐私政策</Text>
        </Text>
      ) : null}
      <View style={styles.controls} onLayout={onControlsLayout}>
        <Pressable style={[styles.button, { backgroundColor: buttonColor }]} onPress={onStart} accessibilityRole="button">
          <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        </Pressable>
        <View style={[styles.indicatorContainer, { width: INDICATOR_WIDTH_PER_STEP * numberOfSteps - 1 + INDICATOR_EXTRA_WIDTH }]}>
          {Array.from({ length: numberOfSteps }, (_, i) => {
            const on = activeStep === i;
            return (
              <Animated.View
                key={i}
                style={[styles.indicator, {
                  flexGrow: on ? 3 : 1,
                  opacity: on ? 1 : 0.2,
                  backgroundColor: useSlideWhiteTheme ? '#FFFFFF' : on ? theme.colors.primary : theme.colors.surfaceInverted,
                  transitionProperty: ['flexGrow', 'opacity', 'backgroundColor'],
                  transitionTimingFunction: 'ease-in-out',
                  transitionDuration: 500,
                }]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.xl },
  terms: { ...theme.typography.body.xxs, color: theme.colors.secondary, textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
  indicatorContainer: { flexDirection: 'row', gap: theme.spacing.xxs },
  indicator: { height: 3, borderRadius: theme.borderRadius.full },
  controls: { alignItems: 'center', gap: theme.spacing.md, paddingBottom: rt.insets.bottom + theme.spacing.md },
  button: { height: 40, paddingHorizontal: 40, borderRadius: theme.borderRadius.full, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...theme.typography.buttonMedium },
}));
