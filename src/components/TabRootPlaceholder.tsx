// Step 1 only: a tab's root screen until its own step builds it. It scrolls, keeps its content clear of the bar, and
// goes back to the top when its tab is pressed again (useTabDoubleTap), so the shell can be tried out.
import { useRef, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import type { BottomTabRouteName } from '../navigation/routes';
import { useTabDoubleTap } from '../stores/useTabDoubleTapStore';
import { BAR_BOTTOM_OFFSET, TAB_BAR_HOME_HEIGHT } from './bar/constants';

type Props = { tab?: BottomTabRouteName; title: string; note: string; children?: ReactNode };

export function TabRootPlaceholder({ tab, title, note, children }: Props) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  useTabDoubleTap(tab ?? 'Home', () => { if (tab) scroll.current?.scrollTo({ y: 0, animated: true }); });
  return (
    <ScrollView
      ref={scroll}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + BAR_BOTTOM_OFFSET + TAB_BAR_HOME_HEIGHT + 24 }]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: theme.spacing.xl, gap: theme.spacing.xs },
  title: { ...theme.typography.headingLarge, color: theme.colors.primary },
  note: { ...theme.typography.regular, color: theme.colors.tertiary },
}));
