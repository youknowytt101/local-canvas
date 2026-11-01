// The frame of Cosmos' onboarding steps as LoginScreen uses it: OnboardingContentWrapper (contentAlignment top) with
// the OnboardingTitle, the form (16 to each side, 24 above, 16 between the fields), and OnboardingFooter's button
// (24 to each side, the bottom inset + 16 below, 12 under the content), kept above the keyboard.
// Left out: OnboardingStepHeader's 帮助 (it opens Cosmos' help centre).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../Button';
import { OnboardingTitle } from './OnboardingTitle';

type Props = {
  title: string;
  subtitle?: string | null;
  subtitleColor?: 'default' | 'alert' | 'success';
  children: ReactNode;
  button: { text: string; onPress: () => void; disabled?: boolean; loading?: boolean };
};

export function OnboardingStep({ title, subtitle, subtitleColor, children, button }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <OnboardingTitle title={title} subtitle={subtitle} subtitleColor={subtitleColor} />
        <View style={styles.form}>{children}</View>
      </View>
      <KeyboardStickyView>
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Button text={button.text} onPress={button.onPress} disabled={button.disabled} loading={button.loading} fullWidth size="extraLarge" />
          </View>
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, width: '100%' },
  form: { width: '100%', paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.xl, gap: theme.spacing.md },
  footer: { paddingHorizontal: theme.spacing.xl, paddingBottom: rt.insets.bottom + theme.spacing.md },
  footerContent: { marginBottom: theme.spacing.sm },
}));
