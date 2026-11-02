// Cosmos' NoteElement (components/elements/NoteElement.js) with EnrichedMarkdownText (react-native-enriched-markdown
// 1.1.1): a note's Markdown, the numbers cosmos-lite read for 6.132.
//   - compact (a tile): on the page's background with a hairline surfaceBorder, at most 18 % of the screen high,
//     centred and cut off, spacing.md in; the words typography.caption with 20 lines, # and ## both heading.xs on 20
//   - the viewer: the whole width, from the top, spacing.md in (none over it); the words typography.large on 25, # is
//     heading.xl and ## heading.lg
//   - the list markers tertiary. NoteElement's letterSpacing -2 is not read by the library (left out, as Cosmos' is).
import { Dimensions, View } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

const COMPACT_HEIGHT_RATIO = 0.18;

export function NoteElement({ text, compact, onLayout }: { text: string; compact?: boolean; onLayout?: () => void }) {
  const { theme } = useUnistyles();
  const t = theme.typography;
  const color = theme.colors.primary;
  const style: MarkdownStyle = compact
    ? {
      paragraph: { ...t.caption, lineHeight: 20, color, marginBottom: 0 },
      h1: { ...t.heading.xs, lineHeight: 20, color },
      h2: { ...t.heading.xs, lineHeight: 20, color },
      list: { ...t.caption, lineHeight: 20, color, bulletColor: theme.colors.tertiary, markerColor: theme.colors.tertiary },
    }
    : {
      paragraph: { ...t.large, lineHeight: 25, color },
      h1: { ...t.heading.xl, color },
      h2: { ...t.heading.lg, color },
      list: { ...t.large, lineHeight: 25, color, bulletColor: theme.colors.tertiary, markerColor: theme.colors.tertiary },
    };
  return (
    <View
      style={[compact ? styles.compact : styles.full, compact && { maxHeight: Math.round(Dimensions.get('screen').height * COMPACT_HEIGHT_RATIO) }]}
      onLayout={onLayout}
    >
      <EnrichedMarkdownText markdown={text} markdownStyle={style as never} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  compact: {
    backgroundColor: theme.colors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    justifyContent: 'center', overflow: 'hidden', padding: theme.spacing.md,
  },
  full: { width: '100%', backgroundColor: theme.colors.background, padding: theme.spacing.md, paddingTop: 0 },
}));
