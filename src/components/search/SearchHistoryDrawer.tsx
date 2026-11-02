// Cosmos' SearchHistoryDrawer (SearchScreen's Drawer: SEARCH_HISTORY_DRAWER_WIDTH 267, drawerType slide — the page moves
// right with it — on colors.elevated, a clear scrim that closes it) with SearchHistoryCard / SearchHistoryCardImage
// (read for the web page, cosmos-lite HANDOFF 6.133 / 6.134):
//   - a header 40 high: 最近搜索 (search.recents, headingMedium) and 清除 (search.clear, caption, tertiary)
//   - cards spacing.xs apart: 52 high on the background colour, a hairline surfaceBorder outline, shadows.small,
//     borderRadius.sm, spacing.xs in on the left and between; the picture — a term's elevated 40 circle with the glass
//     (16, tertiary), a collection's cover, a person's avatar —, the title (regular) over the subtitle (caption,
//     tertiary: @owner / @username), and a 44 wide remove (CloseIcon 20, tertiary)
//   - none: 当你探索 Cosmos 时，/ 你的搜索记录会保存在这里。(search.recentsEmpty)
// Near Cosmos: it opens and closes with a 300 ms ease (Cosmos' drawer has its own), and does not open by dragging from
// the left edge.
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { historyKey, type HistoryEntry } from '../../lib/searchHistory';
import { absoluteUrl } from '../../lib/server';
import { CloseIcon, SearchIcon } from '../icons';
import { Avatar } from '../profile/ProfileInfo';

export const SEARCH_HISTORY_DRAWER_WIDTH = 267;

type Props = {
  progress: SharedValue<number>; open: boolean; items: HistoryEntry[];
  onClose: () => void; onItemPress: (e: HistoryEntry) => void; onRemove: (e: HistoryEntry) => void; onClear: () => void;
};

export function SearchHistoryDrawer({ progress, open, items, onClose, onItemPress, onRemove, onClear }: Props) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const drawerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.get() - 1) * SEARCH_HISTORY_DRAWER_WIDTH }] }));
  return (
    <>
      {open ? <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭最近搜索" /> : null}
      <Animated.View style={[styles.drawer, { paddingTop: insets.top + theme.spacing.sm }, drawerStyle]} pointerEvents={open ? 'auto' : 'none'}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>最近搜索</Text>
          {items.length ? <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button"><Text style={styles.clear}>清除</Text></Pressable> : null}
        </View>
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          {items.length ? items.map((e) => <Card key={historyKey(e)} entry={e} onPress={() => onItemPress(e)} onRemove={() => onRemove(e)} />)
            : <Text style={styles.empty}>{'当你探索 Cosmos 时，\n你的搜索记录会保存在这里。'}</Text>}
        </ScrollView>
      </Animated.View>
    </>
  );
}

function Card({ entry: e, onPress, onRemove }: { entry: HistoryEntry; onPress: () => void; onRemove: () => void }) {
  const { theme } = useUnistyles();
  const cover = e.kind === 'cluster' ? e.cluster.covers?.[0] : null;
  const image = e.kind === 'user' ? <Avatar user={e.user} size={40} />
    : e.kind === 'cluster' ? (cover ? <Image source={{ uri: absoluteUrl(cover) }} style={styles.icon} contentFit="cover" /> : <View style={styles.icon} />)
      : <View style={styles.icon}><SearchIcon color={theme.colors.tertiary} size={16} /></View>;
  const title = e.kind === 'user' ? e.user.fullName || e.user.username : e.kind === 'cluster' ? e.cluster.name : e.searchTerm;
  const subtitle = e.kind === 'user' ? `@${e.user.username}` : e.kind === 'cluster' ? `@${e.cluster.owner ?? ''}` : null;
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardMain} onPress={onPress} accessibilityRole="button">
        {image}
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </Pressable>
      <Pressable style={styles.remove} onPress={onRemove} accessibilityRole="button" accessibilityLabel="移除">
        <CloseIcon color={theme.colors.tertiary} size={20} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: SEARCH_HISTORY_DRAWER_WIDTH, zIndex: 9 },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: SEARCH_HISTORY_DRAWER_WIDTH, backgroundColor: theme.colors.elevated,
    paddingHorizontal: theme.spacing.md, zIndex: 10,
  },
  header: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...theme.typography.headingMedium, color: theme.colors.primary },
  clear: { ...theme.typography.caption, color: theme.colors.tertiary },
  list: { gap: theme.spacing.xs, paddingTop: theme.spacing.xs },
  empty: { ...theme.typography.regular, color: theme.colors.tertiary, textAlign: 'center', marginTop: theme.spacing.xl },
  card: {
    height: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: theme.borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.surfaceBorder, boxShadow: theme.shadows.small, paddingLeft: theme.spacing.xs,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { ...theme.typography.regular, color: theme.colors.primary },
  cardSubtitle: { ...theme.typography.caption, color: theme.colors.tertiary },
  remove: { width: 44, height: '100%', alignItems: 'center', justifyContent: 'center' },
}));
