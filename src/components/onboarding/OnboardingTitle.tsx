// Cosmos' OnboardingTitle: 24 above, at most 360 wide, the title heading.xl in primary, centred with 20 to each side;
// the subtitle typography.large on a 20 line height, at most 2 lines, in tertiary (alert / green for an error /
// success), in a 40 high box at the bottom of the 44 left under the title.
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { colorPalette } from '../../theme/tokens';

type Props = { title: string; subtitle?: string | null; subtitleColor?: 'default' | 'alert' | 'success' };

export function OnboardingTitle({ title, subtitle, subtitleColor = 'default' }: Props) {
  return (
    <View style={styles.container}>
      <View style={[styles.content, subtitle ? styles.contentWithSubtitle : null]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle(subtitleColor)} numberOfLines={SUBTITLE_LINES}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const SUBTITLE_LINE_HEIGHT = 20;
const SUBTITLE_LINES = 2;

const styles = StyleSheet.create((theme) => ({
  container: { width: '100%', alignItems: 'center', paddingTop: theme.spacing.xl },
  content: { position: 'relative', width: '100%', maxWidth: 360 },
  contentWithSubtitle: { paddingBottom: theme.spacing.xxs + 40 },
  title: { ...theme.typography.heading.xl, color: theme.colors.primary, textAlign: 'center', paddingHorizontal: theme.spacing.lg },
  subtitleContainer: {
    position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: 0, height: 40,
    justifyContent: 'flex-start', alignItems: 'center',
  },
  subtitle: (tone: 'default' | 'alert' | 'success') => ({
    ...theme.typography.large,
    color: tone === 'alert' ? theme.colors.alert : tone === 'success' ? colorPalette.green : theme.colors.tertiary,
    lineHeight: SUBTITLE_LINE_HEIGHT,
    textAlign: 'center',
  }),
}));
