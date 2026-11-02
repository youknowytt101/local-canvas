// Cosmos' SearchLanding (module 3502) with SearchStarterCard (SearchStarterCardSkeleton's styles), what search shows
// before anything is typed, at the bottom of the screen over the bar (and the keyboard):
//   - the title (headingLarge, 26 high, primary): 开始你的 / 下一个项目, or once there are recent searches 找到你的 /
//     下一个参考 (search.landingTitle / landingTitleReturning), spacing.sm over the subtitle (regular, 18 high,
//     tertiary): 为你的衣橱、家居 / 或正在进行的任何项目寻找灵感。
//   - spacing.lg under them the starters in three rows (first / second / third), spacing.xs apart, scrolling sideways
//     together: a card 52 high, 10 in on the left and between, spacing.sm on the right, borderRadius.sm, a hairline
//     surfaceBorder outline, the background colour, shadows.small; a 32 picture (borderRadius.xs, elevated while it
//     loads), the term (regular, primary) over its count (caption, tertiary). Pressing one searches for it.
// The starters come from /api/search/starters: the library's most common keywords (Cosmos' are chosen by its people,
// AdminSearchStarter). While they load, skeleton cards (a 100 and a 60 wide bar).
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { absoluteUrl } from '../../lib/server';

export type Starter = { id: string; searchTerm: string; primaryText: string; secondaryText?: string; coverImage?: string | null };

const CARD_HEIGHT = 52;
const IMAGE_SIZE = 32;
const CARD_GAP = 10;
const SKELETON_ROWS = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];

type Props = { starters: Starter[] | null; returning: boolean; onStarterPress: (s: Starter) => void };

export function SearchLanding({ starters, returning, onStarterPress }: Props) {
  const rows = starters ? [0, 1, 2].map((r) => starters.filter((_, i) => i % 3 === r)) : null;
  return (
    <View style={styles.container}>
      <View style={styles.titleColumn}>
        <Text style={styles.title}>{returning ? '找到你的\n下一个参考' : '开始你的\n下一个项目'}</Text>
        <Text style={styles.subtitle}>{'为你的衣橱、家居\n或正在进行的任何项目寻找灵感。'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.starters}>
          {rows ? rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((s) => (
                <Pressable key={s.id} style={styles.card} onPress={() => onStarterPress(s)} accessibilityRole="button">
                  {s.coverImage ? <Image source={{ uri: absoluteUrl(s.coverImage) }} style={styles.image} contentFit="cover" /> : <View style={[styles.image, styles.imagePlaceholder]} />}
                  <View style={styles.textColumn}>
                    <Text style={styles.primaryText} numberOfLines={1}>{s.primaryText}</Text>
                    {s.secondaryText ? <Text style={styles.secondaryText} numberOfLines={1}>{s.secondaryText}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )) : SKELETON_ROWS.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((i) => (
                <View key={i} style={styles.card}>
                  <View style={[styles.image, styles.imagePlaceholder]} />
                  <View style={styles.textColumn}>
                    <View style={[styles.skeletonBar, styles.skeletonTitle]} />
                    <View style={[styles.skeletonBar, styles.skeletonSubtitle]} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.lg },
  titleColumn: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  title: { ...theme.typography.headingLarge, lineHeight: 26, color: theme.colors.primary },
  subtitle: { ...theme.typography.regular, lineHeight: 18, color: theme.colors.tertiary },
  scroll: { paddingHorizontal: theme.spacing.md, paddingVertical: 4 },
  starters: { gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.xs },
  card: {
    height: CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: CARD_GAP, paddingLeft: CARD_GAP, paddingRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.background, boxShadow: theme.shadows.small,
  },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: theme.borderRadius.xs },
  imagePlaceholder: { backgroundColor: theme.colors.elevated },
  textColumn: { flexShrink: 1 },
  primaryText: { ...theme.typography.regular, color: theme.colors.primary },
  secondaryText: { ...theme.typography.caption, color: theme.colors.tertiary },
  skeletonBar: { height: 10, borderRadius: theme.borderRadius.xxs, backgroundColor: theme.colors.elevated },
  skeletonTitle: { width: 100 },
  skeletonSubtitle: { width: 60, marginTop: 2 },
}));
