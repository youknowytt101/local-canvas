// Cosmos' HomeFeedEmptyState (module 3453) and ForYouGuardState's error: the texts of Cosmos' Chinese pack
// (home.feedEmptyStateTitle / feedEmptyStateSubtitleForYou / feedEmptyStateSubtitleFollowing, forYouErrorTitle /
// forYouErrorSubtitle); the layout (centred, headingMedium over regular tertiary) is local.
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '../Button';

type Props = { kind: 'for-you' | 'following' | 'error'; onRetry?: () => void };

export function HomeFeedEmptyState({ kind, onRetry }: Props) {
  const title = kind === 'error' ? '我们无法为您加载' : '您的 Feed 正在成型';
  const subtitle = kind === 'error' ? '请再试一次。'
    : kind === 'for-you' ? '您的 For You feed 正在整合。 \n请稍后再回来查看' : '您的以下提要即将汇集。 \n请稍后再回来查看';
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onRetry ? <Button text="重试" variant="secondary" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.xxxxl, gap: theme.spacing.xs },
  title: { ...theme.typography.headingMedium, color: theme.colors.primary, textAlign: 'center' },
  subtitle: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center' },
  button: { marginTop: theme.spacing.md },
}));
